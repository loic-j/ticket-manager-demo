import { RedisCacheStore } from './redis-cache-store.js';

describe('RedisCacheStore without a reachable backend', () => {
  it('answers misses and no-ops instead of throwing or waiting', async () => {
    const store = new RedisCacheStore({
      enabled: true,
      url: 'redis://127.0.0.1:1',
      ttlMs: 1000,
      timeoutMs: 100,
      keyPrefix: 't:',
    });
    store.onModuleInit();
    const started = Date.now();
    expect(await store.get('k')).toBeUndefined();
    await store.set('k', { a: 1 }, 1000);
    await store.delete('k');
    expect(await store.get('k')).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(500);
    await store.onModuleDestroy();
  });
});
