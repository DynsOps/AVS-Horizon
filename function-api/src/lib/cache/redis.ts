import { env } from '../env';

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
};

type CacheReadResult<T> = {
  status: 'hit' | 'miss' | 'bypass';
  value?: T;
};

let redisClient: RedisLike | null = null;
let redisInitializationAttempted = false;
let redisWarningLogged = false;
let redisFactoryForTests: (() => RedisLike | null) | null = null;

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
};

const cacheEnabled = (): boolean => parseBoolean(env.fabricCacheEnabledRaw, true);

const getRedisClient = (): RedisLike | null => {
  if (!cacheEnabled()) return null;
  if (!env.redisUrl) return null;
  if (redisInitializationAttempted) return redisClient;

  redisInitializationAttempted = true;

  try {
    const create = redisFactoryForTests
      ? redisFactoryForTests
      : (() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Redis = require('ioredis');
        return new Redis(env.redisUrl) as RedisLike;
      });

    redisClient = create();
    if (redisClient?.on) {
      redisClient.on('error', (error: unknown) => {
        if (!redisWarningLogged) {
          redisWarningLogged = true;
          console.warn('Redis error, bypassing cache.', error);
        }
      });
    }
  } catch (error) {
    if (!redisWarningLogged) {
      redisWarningLogged = true;
      console.warn('Redis init failed, bypassing cache.', error);
    }
    redisClient = null;
  }

  return redisClient;
};

export const readJsonCache = async <T>(key: string): Promise<CacheReadResult<T>> => {
  const client = getRedisClient();
  if (!client) return { status: 'bypass' };

  try {
    const raw = await client.get(key);
    if (!raw) return { status: 'miss' };
    return { status: 'hit', value: JSON.parse(raw) as T };
  } catch (error) {
    if (!redisWarningLogged) {
      redisWarningLogged = true;
      console.warn('Redis read failed, bypassing cache.', error);
    }
    return { status: 'bypass' };
  }
};

export const writeJsonCache = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return;

  try {
    await client.set(key, JSON.stringify(value), 'EX', Math.floor(ttlSeconds));
  } catch (error) {
    if (!redisWarningLogged) {
      redisWarningLogged = true;
      console.warn('Redis write failed, bypassing cache.', error);
    }
  }
};

export const setRedisFactoryForTests = (factory: (() => RedisLike | null) | null): void => {
  redisFactoryForTests = factory;
  redisClient = null;
  redisInitializationAttempted = false;
  redisWarningLogged = false;
};

