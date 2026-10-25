import type { DirectoryUser } from '@ticketmanager/contracts';
import type { UserDirectory } from '../application/ports/user-directory.js';

export interface CacheOptions {
  /** Lifetime of a found profile. */
  ttlMs: number;
  /** Lifetime of an "unknown user" answer (deleted account, typo). Default 60 s. */
  negativeTtlMs?: number;
  maxSize: number;
  now?: () => number;
}

const DEFAULT_NEGATIVE_TTL_MS = 60_000;

/**
 * In-memory cache in front of another directory. `findByIds` only asks the inner directory for
 * the ids it does not hold; ids the inner directory does not know are cached as `null` for a
 * short time so a page listing a deleted user does not hit Logto on every render. Eviction is
 * oldest-insertion-first once `maxSize` is reached.
 */
export class CachingUserDirectory implements UserDirectory {
  private readonly entries = new Map<string, { user: DirectoryUser | null; expiresAt: number }>();
  private readonly now: () => number;
  private readonly negativeTtlMs: number;

  constructor(
    private readonly inner: UserDirectory,
    private readonly options: CacheOptions,
  ) {
    this.now = options.now ?? Date.now;
    this.negativeTtlMs = options.negativeTtlMs ?? DEFAULT_NEGATIVE_TTL_MS;
  }

  async findById(id: string): Promise<DirectoryUser | null> {
    return (await this.findByIds([id]))[0] ?? null;
  }

  async findByIds(ids: readonly string[]): Promise<DirectoryUser[]> {
    const resolved = new Map<string, DirectoryUser | null>();
    const misses: string[] = [];
    for (const id of ids) {
      const cached = this.read(id);
      if (cached === undefined) misses.push(id);
      else resolved.set(id, cached);
    }

    if (misses.length > 0) {
      const fetched = new Map((await this.inner.findByIds(misses)).map((u) => [u.id, u]));
      for (const id of misses) {
        const user = fetched.get(id) ?? null;
        this.write(id, user);
        resolved.set(id, user);
      }
    }

    return ids.flatMap((id) => {
      const user = resolved.get(id);
      return user ? [user] : [];
    });
  }

  private read(id: string): DirectoryUser | null | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(id);
      return undefined;
    }
    return entry.user;
  }

  private write(id: string, user: DirectoryUser | null): void {
    this.entries.delete(id);
    if (this.entries.size >= this.options.maxSize) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    const ttl = user ? this.options.ttlMs : this.negativeTtlMs;
    this.entries.set(id, { user, expiresAt: this.now() + ttl });
  }
}
