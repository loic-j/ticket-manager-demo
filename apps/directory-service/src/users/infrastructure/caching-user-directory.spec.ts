import type { DirectoryUser } from '@ticketmanager/contracts';
import { describe, expect, it } from 'vitest';
import type { UserDirectory } from '../application/ports/user-directory.js';
import { CachingUserDirectory } from './caching-user-directory.js';
import { StaticUserDirectory, user } from './testing.js';

/** Inner directory whose batches complete only when the test releases them. */
class DeferredUserDirectory implements UserDirectory {
  readonly lookups: string[][] = [];
  private readonly releases: (() => void)[] = [];

  async findById(id: string): Promise<DirectoryUser | null> {
    return (await this.findByIds([id]))[0] ?? null;
  }

  findByIds(ids: readonly string[]): Promise<DirectoryUser[]> {
    this.lookups.push([...ids]);
    return new Promise((resolve, reject) => {
      this.releases.push(() => resolve(ids.filter((id) => id !== 'ghost').map((id) => user(id))));
      this.failures.push(reject);
    });
  }

  private readonly failures: ((error: Error) => void)[] = [];

  release(): void {
    this.releases.shift()!();
    this.failures.shift();
  }

  fail(error: Error): void {
    this.releases.shift();
    this.failures.shift()!(error);
  }
}

function setup(maxSize = 10) {
  let clock = 0;
  const inner = new StaticUserDirectory([user('u1'), user('u2'), user('u3')]);
  const cache = new CachingUserDirectory(inner, {
    ttlMs: 1000,
    negativeTtlMs: 100,
    maxSize,
    now: () => clock,
  });
  return { inner, cache, tick: (ms: number) => (clock += ms) };
}

describe('CachingUserDirectory', () => {
  it('serves repeated lookups from the cache', async () => {
    const { inner, cache } = setup();
    expect(await cache.findById('u1')).toEqual(user('u1'));
    expect(await cache.findById('u1')).toEqual(user('u1'));
    expect(inner.lookups).toEqual([['u1']]);
  });

  it('only asks the inner directory for the misses and keeps the request order', async () => {
    const { inner, cache } = setup();
    await cache.findById('u2');
    expect(await cache.findByIds(['u1', 'u2', 'u3'])).toEqual([user('u1'), user('u2'), user('u3')]);
    expect(inner.lookups).toEqual([['u2'], ['u1', 'u3']]);
  });

  it('expires found profiles after the TTL', async () => {
    const { inner, cache, tick } = setup();
    await cache.findById('u1');
    tick(999);
    await cache.findById('u1');
    expect(inner.lookups).toHaveLength(1);
    tick(1);
    await cache.findById('u1');
    expect(inner.lookups).toHaveLength(2);
  });

  it('caches unknown ids negatively for a shorter time', async () => {
    const { inner, cache, tick } = setup();
    expect(await cache.findById('ghost')).toBeNull();
    expect(await cache.findByIds(['ghost', 'u1'])).toEqual([user('u1')]);
    expect(inner.lookups).toEqual([['ghost'], ['u1']]);
    tick(100);
    await cache.findById('ghost');
    expect(inner.lookups).toHaveLength(3);
  });

  it('evicts the oldest entry once full', async () => {
    const { inner, cache } = setup(2);
    await cache.findByIds(['u1', 'u2']);
    await cache.findById('u3'); // evicts u1
    await cache.findById('u2'); // still cached
    await cache.findById('u1'); // fetched again
    expect(inner.lookups).toEqual([['u1', 'u2'], ['u3'], ['u1']]);
  });

  it('propagates inner failures without caching them', async () => {
    const { inner, cache } = setup();
    inner.failWith = new Error('down');
    await expect(cache.findById('u1')).rejects.toThrow('down');
    inner.failWith = undefined;
    expect(await cache.findById('u1')).toEqual(user('u1'));
  });

  it('shares one inner lookup between concurrent cold calls for the same id', async () => {
    const inner = new DeferredUserDirectory();
    const cache = new CachingUserDirectory(inner, { ttlMs: 1000, maxSize: 10 });

    const first = cache.findById('u1');
    const second = cache.findByIds(['u1', 'u2']);
    expect(inner.lookups).toEqual([['u1'], ['u2']]); // u1 is already in flight
    inner.release();
    inner.release();

    expect(await first).toEqual(user('u1'));
    expect(await second).toEqual([user('u1'), user('u2')]);
    expect(await cache.findByIds(['u1', 'u2'])).toEqual([user('u1'), user('u2')]);
    expect(inner.lookups).toHaveLength(2);
  });

  it('propagates a shared failure to every waiter and retries afterwards', async () => {
    const inner = new DeferredUserDirectory();
    const cache = new CachingUserDirectory(inner, { ttlMs: 1000, maxSize: 10 });

    const first = cache.findById('u1');
    const second = cache.findById('u1');
    inner.fail(new Error('down'));
    await expect(first).rejects.toThrow('down');
    await expect(second).rejects.toThrow('down');

    const third = cache.findById('u1');
    expect(inner.lookups).toEqual([['u1'], ['u1']]);
    inner.release();
    expect(await third).toEqual(user('u1'));
  });
});
