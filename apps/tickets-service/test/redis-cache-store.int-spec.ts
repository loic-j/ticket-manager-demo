import 'dotenv/config';
import { loadCachingConfig } from '../src/caching/caching.config.js';
import { RedisCacheStore } from '../src/caching/infrastructure/redis-cache-store.js';

/** Needs Valkey (`pnpm infra:up`, CACHE_URL in .env or the default localhost:6379). */
describe('RedisCacheStore (integration)', () => {
  const store = new RedisCacheStore({
    ...loadCachingConfig(process.env),
    keyPrefix: `test:${crypto.randomUUID()}:`,
  });

  beforeAll(async () => {
    store.onModuleInit();
    // The connection is opened in the background; wait for it before asserting hits.
    for (let i = 0; i < 50 && (await store.get('warmup')) === undefined; i++) {
      await store.set('warmup', 1, 1000);
      await new Promise((r) => setTimeout(r, 100));
    }
  });

  afterAll(() => store.onModuleDestroy());

  it('round-trips JSON values with a lifetime and deletes several keys at once', async () => {
    await store.set('a', { n: 1, when: '2026-10-26T00:00:00.000Z' }, 10_000);
    await store.set('b', [1, 2, 3], 10_000);
    expect(await store.get('a')).toEqual({ n: 1, when: '2026-10-26T00:00:00.000Z' });
    expect(await store.get('b')).toEqual([1, 2, 3]);
    await store.delete('a', 'b');
    expect(await store.get('a')).toBeUndefined();
    expect(await store.get('b')).toBeUndefined();
  });

  it('expires an entry after its TTL', async () => {
    await store.set('short', 'x', 100);
    expect(await store.get('short')).toBe('x');
    await new Promise((r) => setTimeout(r, 200));
    expect(await store.get('short')).toBeUndefined();
  });
});
