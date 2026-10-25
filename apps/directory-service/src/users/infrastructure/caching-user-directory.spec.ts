import { describe, expect, it } from 'vitest';
import { CachingUserDirectory } from './caching-user-directory.js';
import { StaticUserDirectory, user } from './testing.js';

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
});
