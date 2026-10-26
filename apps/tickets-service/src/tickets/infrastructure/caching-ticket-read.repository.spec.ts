import { InMemoryCacheStore } from '../../caching/infrastructure/testing.js';
import { toTicketView } from '../application/mappers/ticket.mapper.js';
import { createTicket } from '../domain/ticket.js';
import { CacheStoreTicketCache } from './cache-store-ticket-cache.js';
import { CachingTicketReadRepository } from './caching-ticket-read.repository.js';
import { InMemoryTicketRepository } from './testing.js';

describe('CachingTicketReadRepository', () => {
  let now = 1_000_000;
  const setup = async () => {
    const store = new InMemoryTicketRepository();
    const cacheStore = new InMemoryCacheStore(() => now);
    const cache = new CacheStoreTicketCache(cacheStore, { ttlMs: 60_000 });
    const { ticket } = createTicket({ title: 'A', description: '', priority: 'low' }, 'u1');
    await store.insert(ticket);
    return {
      store,
      cacheStore,
      cache,
      view: toTicketView(ticket),
      repo: new CachingTicketReadRepository(store, cache),
    };
  };

  it('serves the second read of a ticket and of the list from the cache', async () => {
    const { repo, cacheStore, view } = await setup();
    expect(await repo.getById(view.id)).toEqual(view);
    expect(await repo.getById(view.id)).toEqual(view);
    expect(await repo.list()).toEqual([view]);
    expect(await repo.list()).toEqual([view]);
    expect(cacheStore.stats).toMatchObject({ misses: 2, hits: 2, sets: 2 });
  });

  it('does not cache a missing ticket', async () => {
    const { repo, cacheStore } = await setup();
    expect(await repo.getById('missing')).toBeNull();
    expect(await repo.getById('missing')).toBeNull();
    expect(cacheStore.stats).toMatchObject({ misses: 2, sets: 0 });
  });

  it('reads the store again after an eviction or once the entry expired', async () => {
    const { repo, store, cache, view } = await setup();
    await repo.getById(view.id);
    const changed = { ...(await store.findById(view.id))!, title: 'Changed', version: 2 };
    await store.update(changed);

    expect((await repo.getById(view.id))?.title).toBe('A'); // still cached
    await cache.evict(view.id);
    expect((await repo.getById(view.id))?.title).toBe('Changed');

    await store.update({ ...changed, title: 'Changed again', version: 3 });
    now += 60_001; // TTL elapsed
    expect((await repo.getById(view.id))?.title).toBe('Changed again');
  });
});
