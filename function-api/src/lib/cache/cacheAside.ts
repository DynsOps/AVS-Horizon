import { readJsonCache, writeJsonCache } from './redis';

// 'db-hit' is produced by the maritime positions orchestrator when Redis misses
// but the DB has fresh data. It cannot be returned by readThroughJsonCache.
export type CacheStatus = 'hit' | 'miss' | 'bypass' | 'db-hit';

type CacheAsideOptions<T> = {
  key: string;
  ttlSeconds: number;
  load: () => Promise<T>;
};

export const readThroughJsonCache = async <T>(options: CacheAsideOptions<T>): Promise<{ value: T; cacheStatus: CacheStatus }> => {
  const cached = await readJsonCache<T>(options.key);
  if (cached.status === 'hit' && typeof cached.value !== 'undefined') {
    return { value: cached.value, cacheStatus: 'hit' };
  }

  const value = await options.load();
  if (cached.status === 'miss') {
    await writeJsonCache(options.key, value, options.ttlSeconds);
  }

  return { value, cacheStatus: cached.status };
};

