import type { CacheStore } from '../application/ports/cache-store.js';

/** Bound when `CACHE_ENABLED=false`: every read is a miss, writes are dropped. */
export class NoopCacheStore implements CacheStore {
  async get<T>(): Promise<T | undefined> {
    return undefined;
  }

  async set(): Promise<void> {}

  async delete(): Promise<void> {}
}
