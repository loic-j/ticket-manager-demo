export const CACHE_STORE = Symbol('CACHE_STORE');

/**
 * Key/value cache of JSON-serialisable values with a per-entry lifetime. A store never throws
 * and never blocks a request on an unavailable backend: an error or a timeout is a miss on
 * `get` and a no-op on `set` / `delete`, so the database stays the source of truth and the
 * service keeps working (slower) without its cache.
 */
export interface CacheStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(...keys: string[]): Promise<void>;
}
