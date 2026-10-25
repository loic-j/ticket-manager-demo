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

type Lookup = Promise<DirectoryUser | null>;

/**
 * In-memory cache in front of another directory. `findByIds` only asks the inner directory for
 * the ids it does not hold; ids the inner directory does not know are cached as `null` for a
 * short time so a page listing a deleted user does not hit Logto on every render. Concurrent
 * cold lookups of the same id share one inner call (a page rendering ten tickets of one author
 * triggers one Logto request, not ten). Eviction is oldest-insertion-first once `maxSize` is
 * reached. Failures are propagated and never cached.
 */
export class CachingUserDirectory implements UserDirectory {
  private readonly entries = new Map<string, { user: DirectoryUser | null; expiresAt: number }>();
  private readonly pending = new Map<string, Lookup>();
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
    const awaited: Promise<void>[] = [];
    const misses: string[] = [];
    for (const id of ids) {
      const cached = this.read(id);
      if (cached !== undefined) {
        resolved.set(id, cached);
        continue;
      }
      const inFlight = this.pending.get(id);
      if (inFlight) {
        awaited.push(inFlight.then((user) => void resolved.set(id, user)));
      } else if (!misses.includes(id)) {
        misses.push(id);
      }
    }

    if (misses.length > 0) {
      const batch = this.inner
        .findByIds(misses)
        .then((users) => new Map(users.map((user) => [user.id, user])));
      for (const id of misses) {
        const lookup: Lookup = batch.then((found) => found.get(id) ?? null);
        this.pending.set(id, lookup);
        awaited.push(
          lookup
            .then((user) => {
              this.write(id, user);
              resolved.set(id, user);
            })
            .finally(() => {
              if (this.pending.get(id) === lookup) this.pending.delete(id);
            }),
        );
      }
    }

    await Promise.all(awaited);
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
