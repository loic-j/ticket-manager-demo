import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadUsersConfig } from '../users.config.js';
import { LogtoUserDirectory } from './logto-user-directory.js';

const m2mEnv = { LOGTO_M2M_APP_ID: 'app', LOGTO_M2M_APP_SECRET: 'secret' };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const idOf = (url: string) => decodeURIComponent(url.slice(url.lastIndexOf('/') + 1));

describe('LogtoUserDirectory', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('answers "unknown" without M2M credentials outside production', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const directory = new LogtoUserDirectory(loadUsersConfig({}));
    expect(await directory.findById('u1')).toBeNull();
    expect(await directory.findByIds(['u1', 'u2'])).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses to start in production without credentials', () => {
    expect(() => loadUsersConfig({ NODE_ENV: 'production' })).toThrow(/LOGTO_M2M_APP_ID/);
  });

  it('requests a Management API token once and maps the Logto user', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      calls.push(u);
      if (u.endsWith('/oidc/token')) {
        const body = Object.fromEntries(init!.body as URLSearchParams);
        expect(body).toEqual({
          grant_type: 'client_credentials',
          resource: 'https://default.logto.app/api',
          scope: 'all',
        });
        return json(200, { access_token: 't1', expires_in: 3600 });
      }
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer t1');
      const id = idOf(u);
      if (id === 'missing') return json(404, {});
      return json(200, {
        id,
        name: id === 'u2' ? null : 'Name',
        primaryEmail: `${id}@x.io`,
        avatar: null,
      });
    });
    const directory = new LogtoUserDirectory(loadUsersConfig(m2mEnv));

    expect(await directory.findById('u1')).toEqual({
      id: 'u1',
      name: 'Name',
      email: 'u1@x.io',
      avatar: null,
    });
    expect(await directory.findByIds(['u2', 'missing', 'u1'])).toEqual([
      { id: 'u2', name: null, email: 'u2@x.io', avatar: null },
      { id: 'u1', name: 'Name', email: 'u1@x.io', avatar: null },
    ]);
    expect(calls.filter((c) => c.endsWith('/oidc/token'))).toHaveLength(1);
    expect(calls.filter((c) => c.includes('/api/users/'))).toHaveLength(4);
  });

  it('bounds the number of concurrent lookups', async () => {
    let inFlight = 0;
    let peak = 0;
    vi.stubGlobal('fetch', async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith('/oidc/token')) return json(200, { access_token: 't', expires_in: 3600 });
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      const id = idOf(u);
      return json(200, { id, name: null, primaryEmail: null, avatar: null });
    });
    const directory = new LogtoUserDirectory(loadUsersConfig(m2mEnv));
    const ids = Array.from({ length: 30 }, (_, i) => `u${i}`);

    const users = await directory.findByIds(ids);

    expect(users.map((u) => u.id)).toEqual(ids);
    expect(peak).toBeLessThanOrEqual(8);
    expect(peak).toBeGreaterThan(1);
  });

  it('turns a malformed stored email into null instead of failing', async () => {
    vi.stubGlobal('fetch', async (url: string | URL) =>
      String(url).endsWith('/oidc/token')
        ? json(200, { access_token: 't', expires_in: 3600 })
        : json(200, { id: 'u1', name: 'A', primaryEmail: 'not-an-email', avatar: null }),
    );
    expect(await new LogtoUserDirectory(loadUsersConfig(m2mEnv)).findById('u1')).toEqual({
      id: 'u1',
      name: 'A',
      email: null,
      avatar: null,
    });
  });

  it('surfaces other HTTP errors', async () => {
    vi.stubGlobal('fetch', async (url: string | URL) =>
      String(url).endsWith('/oidc/token')
        ? json(200, { access_token: 't', expires_in: 3600 })
        : json(500, {}),
    );
    await expect(new LogtoUserDirectory(loadUsersConfig(m2mEnv)).findById('u1')).rejects.toThrow(
      '500',
    );
  });
});
