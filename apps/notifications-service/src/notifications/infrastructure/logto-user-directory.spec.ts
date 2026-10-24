import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadNotificationsConfig } from '../notifications.config.js';
import { LogtoUserDirectory } from './logto-user-directory.js';

const m2mEnv = { LOGTO_M2M_APP_ID: 'app', LOGTO_M2M_APP_SECRET: 'secret' };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('LogtoUserDirectory', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the fallback email only outside production', async () => {
    const env = { NOTIFICATIONS_DEV_FALLBACK_EMAIL: 'dev@x.io' };
    expect(await new LogtoUserDirectory(loadNotificationsConfig(env)).findById('u1')).toEqual({
      email: 'dev@x.io',
      name: null,
    });
    expect(
      await new LogtoUserDirectory(
        loadNotificationsConfig({ ...env, NODE_ENV: 'production' }),
      ).findById('u1'),
    ).toBeNull();
  });

  it('requests one M2M token, caches profiles and refreshes the token on 401', async () => {
    const calls: string[] = [];
    let tokens = 0;
    vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      calls.push(`${init?.method ?? 'GET'} ${u}`);
      if (u.endsWith('/oidc/token'))
        return json(200, { access_token: `t${++tokens}`, expires_in: 3600 });
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const auth = headers.authorization;
      if (u.endsWith('/api/users/missing')) return json(404, {});
      if (auth === 'Bearer t1' && u.endsWith('/api/users/u2')) return json(401, {}); // revoked
      return json(200, { primaryEmail: `${u.slice(u.lastIndexOf('/') + 1)}@x.io`, name: 'N' });
    });
    const directory = new LogtoUserDirectory(loadNotificationsConfig(m2mEnv));

    const [a, b] = await Promise.all([directory.findById('u1'), directory.findById('u1')]);
    expect(a).toEqual({ email: 'u1@x.io', name: 'N' });
    expect(b).toEqual(a);
    expect(calls.filter((c) => c.includes('/oidc/token'))).toHaveLength(1); // single-flight
    expect(await directory.findById('u1')).toEqual(a);
    expect(calls.filter((c) => c.includes('/api/users/u1'))).toHaveLength(2); // concurrent misses, then cached

    expect(await directory.findById('u2')).toEqual({ email: 'u2@x.io', name: 'N' });
    expect(tokens).toBe(2); // refreshed after the 401
    expect(await directory.findById('missing')).toBeNull();
  });

  it('surfaces other HTTP errors', async () => {
    vi.stubGlobal('fetch', async (url: string | URL) =>
      String(url).endsWith('/oidc/token')
        ? json(200, { access_token: 't', expires_in: 3600 })
        : json(500, {}),
    );
    await expect(
      new LogtoUserDirectory(loadNotificationsConfig(m2mEnv)).findById('u1'),
    ).rejects.toThrow('500');
  });
});
