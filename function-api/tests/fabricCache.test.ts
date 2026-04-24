import assert from 'node:assert/strict';
import { env } from '../src/lib/env';
import { readThroughJsonCache } from '../src/lib/cache/cacheAside';
import { setRedisFactoryForTests } from '../src/lib/cache/redis';
import { fetchAllCompanyChainsWithCache } from '../src/lib/fabric/companyChains';
import { fetchAllGroupProjtablesWithCache } from '../src/lib/fabric/groupProjtables';
import { fetchContractedVesselsWithCache } from '../src/lib/fabric/contractedProjtables';

const run = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
};

class FakeRedis {
  store = new Map<string, string>();
  setCalls: Array<{ key: string; ttl: number }> = [];
  throwOnGet = false;

  async get(key: string): Promise<string | null> {
    if (this.throwOnGet) throw new Error('redis-get-failed');
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<'OK'> {
    assert.equal(mode, 'EX');
    this.setCalls.push({ key, ttl: ttlSeconds });
    this.store.set(key, value);
    return 'OK';
  }
}

const restoreDefaults = () => {
  env.redisUrl = 'redis://fake:6379';
  env.fabricCacheEnabledRaw = 'true';
  env.fabricCacheGroupProjtablesTtlSecondsRaw = '604800';
  env.fabricCacheCompanyChainsTtlSecondsRaw = '86400';
  env.fabricCacheContractedVesselsTtlSecondsRaw = '86400';
  setRedisFactoryForTests(null);
};

const withPatchedGraphql = async <T>(
  handler: (query: string, variables?: Record<string, unknown>) => Promise<unknown>,
  runFn: () => Promise<T>
): Promise<T> => {
  const clientModule = require('../src/lib/fabric/client');
  const original = clientModule.runGraphqlQuery;
  clientModule.runGraphqlQuery = handler;
  try {
    return await runFn();
  } finally {
    clientModule.runGraphqlQuery = original;
  }
};

const main = async () => {
  await run('cache-aside returns hit when redis has value', async () => {
    restoreDefaults();
    const redis = new FakeRedis();
    redis.store.set('k1', JSON.stringify({ ok: true }));
    setRedisFactoryForTests(() => redis);

    let loaderCalls = 0;
    const result = await readThroughJsonCache({
      key: 'k1',
      ttlSeconds: 30,
      load: async () => {
        loaderCalls += 1;
        return { ok: false };
      },
    });

    assert.equal(result.cacheStatus, 'hit');
    assert.deepEqual(result.value, { ok: true });
    assert.equal(loaderCalls, 0);
  });

  await run('cache-aside returns miss and writes on redis miss', async () => {
    restoreDefaults();
    const redis = new FakeRedis();
    setRedisFactoryForTests(() => redis);

    const result = await readThroughJsonCache({
      key: 'k2',
      ttlSeconds: 45,
      load: async () => ({ payload: 'fabric' }),
    });

    assert.equal(result.cacheStatus, 'miss');
    assert.deepEqual(result.value, { payload: 'fabric' });
    assert.equal(redis.setCalls.length, 1);
    assert.equal(redis.setCalls[0].key, 'k2');
    assert.equal(redis.setCalls[0].ttl, 45);
  });

  await run('cache-aside fail-open bypasses redis errors and still returns upstream value', async () => {
    restoreDefaults();
    const redis = new FakeRedis();
    redis.throwOnGet = true;
    setRedisFactoryForTests(() => redis);

    const result = await readThroughJsonCache({
      key: 'k3',
      ttlSeconds: 45,
      load: async () => ({ payload: 'fabric-upstream' }),
    });

    assert.equal(result.cacheStatus, 'bypass');
    assert.deepEqual(result.value, { payload: 'fabric-upstream' });
    assert.equal(redis.setCalls.length, 0);
  });

  await run('group-projtables caches full dataset once and applies q/limit in memory', async () => {
    restoreDefaults();
    const redis = new FakeRedis();
    setRedisFactoryForTests(() => redis);
    let upstreamCalls = 0;

    await withPatchedGraphql(
      async () => {
        upstreamCalls += 1;
        return {
          groupProjtables: {
            items: [
              { name: 'Alpha Marine', dataareaid: 'da1', projid: 'p1' },
              { name: 'Beta Ship', dataareaid: 'da2', projid: 'p2' },
            ],
          },
        };
      },
      async () => {
        const first = await fetchAllGroupProjtablesWithCache({ query: 'alpha', limit: 10 });
        const second = await fetchAllGroupProjtablesWithCache({ query: 'alpha', limit: 20 });
        assert.equal(first.cacheStatus, 'miss');
        assert.equal(second.cacheStatus, 'hit');
        assert.equal(first.items.length, 1);
        assert.equal(second.items.length, 1);
      }
    );

    assert.equal(upstreamCalls, 1);
    assert.equal(redis.setCalls.length, 1);
    assert.equal(redis.setCalls[0].key, 'fabric:group-projtables:all');
  });

  await run('invalid ttl values fallback to safe defaults', async () => {
    restoreDefaults();
    env.fabricCacheCompanyChainsTtlSecondsRaw = 'invalid';
    const redis = new FakeRedis();
    setRedisFactoryForTests(() => redis);

    await withPatchedGraphql(
      async () => ({
        companyChains: {
          items: [{ chainid: 'ACME', dataareaid: 'DAT' }],
        },
      }),
      async () => {
        const result = await fetchAllCompanyChainsWithCache();
        assert.equal(result.cacheStatus, 'miss');
        assert.equal(result.items.length, 1);
      }
    );

    assert.equal(redis.setCalls.length, 1);
    assert.equal(redis.setCalls[0].key, 'fabric:company-chains:all');
    assert.equal(redis.setCalls[0].ttl, 86400);
  });

  await run('upstream errors bubble up instead of returning stale values', async () => {
    restoreDefaults();
    const redis = new FakeRedis();
    setRedisFactoryForTests(() => redis);

    let thrownMessage = '';
    try {
      await readThroughJsonCache({
        key: 'k4',
        ttlSeconds: 120,
        load: async () => {
          throw new Error('upstream-failed');
        },
      });
    } catch (error) {
      thrownMessage = error instanceof Error ? error.message : 'unknown';
    }

    assert.equal(thrownMessage, 'upstream-failed');
  });

  await run('contracted-vessels cache hit skips upstream call', async () => {
    restoreDefaults();
    const redis = new FakeRedis();
    const cached = [{ imo: 'IMO1234567', name: 'Test Vessel', dataAreaId: 'avs', projIdDataAreaIds: ['Prj-001,avs'] }];
    redis.store.set('fabric:contracted-vessels:top:Prj-001,avs', JSON.stringify(cached));
    setRedisFactoryForTests(() => redis);

    let upstreamCalls = 0;
    await withPatchedGraphql(
      async () => { upstreamCalls += 1; return { projtables: { items: [] } }; },
      async () => {
        const result = await fetchContractedVesselsWithCache('Prj-001,avs');
        assert.equal(result.cacheStatus, 'hit');
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].imo, 'IMO1234567');
      }
    );
    assert.equal(upstreamCalls, 0);
  });

  await run('contracted-vessels cache miss calls upstream and writes grouped result to redis', async () => {
    restoreDefaults();
    const redis = new FakeRedis();
    setRedisFactoryForTests(() => redis);

    await withPatchedGraphql(
      async () => ({
        projtables: {
          items: [
            { avscarriercode: 'IMO9999999', dataareaid: 'avs', refShippingCarriername: 'Sea Star', ProjId_dataAreaId: 'Prj-001,avs' },
          ],
        },
      }),
      async () => {
        const result = await fetchContractedVesselsWithCache('Prj-001,avs');
        assert.equal(result.cacheStatus, 'miss');
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].imo, 'IMO9999999');
        assert.equal(result.items[0].name, 'Sea Star');
      }
    );

    assert.equal(redis.setCalls.length, 1);
    assert.equal(redis.setCalls[0].key, 'fabric:contracted-vessels:top:Prj-001,avs');
    assert.equal(redis.setCalls[0].ttl, 86400);
  });

  await run('contracted-vessels redis error triggers bypass and still returns upstream value', async () => {
    restoreDefaults();
    const redis = new FakeRedis();
    redis.throwOnGet = true;
    setRedisFactoryForTests(() => redis);

    await withPatchedGraphql(
      async () => ({
        projtables: {
          items: [
            { avscarriercode: 'IMO1111111', dataareaid: 'avs', refShippingCarriername: 'Bypass Ship', ProjId_dataAreaId: 'Prj-001,avs' },
          ],
        },
      }),
      async () => {
        const result = await fetchContractedVesselsWithCache('Prj-001,avs');
        assert.equal(result.cacheStatus, 'bypass');
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].imo, 'IMO1111111');
      }
    );

    assert.equal(redis.setCalls.length, 0);
  });

  await run('contracted-vessels groups multiple rows by avscarriercode into single vessel', async () => {
    restoreDefaults();
    const redis = new FakeRedis();
    setRedisFactoryForTests(() => redis);

    await withPatchedGraphql(
      async () => ({
        projtables: {
          items: [
            { avscarriercode: 'IMO7777777', dataareaid: 'avs', refShippingCarriername: 'Alpha Carrier', ProjId_dataAreaId: 'Prj-001,avs' },
            { avscarriercode: 'IMO7777777', dataareaid: 'avs', refShippingCarriername: null, ProjId_dataAreaId: 'Prj-002,avs' },
            { avscarriercode: 'IMO7777777', dataareaid: 'avs', refShippingCarriername: '', ProjId_dataAreaId: 'Prj-003,avs' },
          ],
        },
      }),
      async () => {
        const result = await fetchContractedVesselsWithCache('Prj-001,avs');
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].imo, 'IMO7777777');
        assert.equal(result.items[0].name, 'Alpha Carrier');
        assert.equal(result.items[0].projIdDataAreaIds.length, 3);
      }
    );
  });

  await run('contracted-vessels invalid ttl falls back to 86400 default', async () => {
    restoreDefaults();
    env.fabricCacheContractedVesselsTtlSecondsRaw = 'not-a-number';
    const redis = new FakeRedis();
    setRedisFactoryForTests(() => redis);

    await withPatchedGraphql(
      async () => ({ projtables: { items: [] } }),
      async () => {
        await fetchContractedVesselsWithCache('Prj-001,avs');
      }
    );

    assert.equal(redis.setCalls.length, 1);
    assert.equal(redis.setCalls[0].ttl, 86400);
  });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
