import type { CacheStore } from '../application/ports/cache-store.js';

/** Test double: a `Map` with per-entry expiry, `now` injectable to test lifetimes. */
export class InMemoryCacheStore implements CacheStore {
  readonly entries = new Map<string, { value: unknown; expiresAt: number }>();
  /** Operation counters, for asserting that a read was served from the cache. */
  readonly stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };

  constructor(private readonly now: () => number = Date.now) {}

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      this.stats.misses++;
      return undefined;
    }
    this.stats.hits++;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.stats.sets++;
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  async delete(...keys: string[]): Promise<void> {
    this.stats.deletes++;
    for (const key of keys) this.entries.delete(key);
  }
}
