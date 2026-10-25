import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadNotificationsConfig } from '../notifications.config.js';
import { DevFallbackUserDirectory } from './dev-fallback-user-directory.js';
import { HttpUserDirectory } from './http-user-directory.js';

const m2mEnv = {
  LOGTO_M2M_APP_ID: 'app',
  LOGTO_M2M_APP_SECRET: 'secret',
  DIRECTORY_API_URL: 'http://directory:3003',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('HttpUserDirectory', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests an M2M token for the directory resource and maps the profile', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      calls.push(u);
      if (u === 'http://localhost:3301/oidc/token') {
        expect(Object.fromEntries(init!.body as URLSearchParams)).toEqual({
          grant_type: 'client_credentials',
          resource: 'https://directory.ticketmanager.local',
          scope: 'read:users',
        });
        return json(200, { access_token: 't1', expires_in: 3600 });
      }
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer t1');
      if (u.endsWith('/users/missing')) return json(404, { message: 'User missing not found' });
      return json(200, { id: 'u1', name: 'Alice', email: 'alice@x.io', avatar: null });
    });
    const directory = new HttpUserDirectory(loadNotificationsConfig(m2mEnv));

    expect(await directory.findById('u1')).toEqual({ email: 'alice@x.io', name: 'Alice' });
    expect(await directory.findById('missing')).toBeNull();
    expect(calls).toEqual([
      'http://localhost:3301/oidc/token',
      'http://directory:3003/users/u1',
      'http://directory:3003/users/missing',
    ]);
  });

  it('retries once with a fresh token on 401', async () => {
    let tokens = 0;
    vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
      if (String(url).endsWith('/oidc/token'))
        return json(200, { access_token: `t${++tokens}`, expires_in: 3600 });
      return new Headers(init?.headers).get('authorization') === 'Bearer t1'
        ? json(401, {})
        : json(200, { id: 'u1', name: null, email: null, avatar: null });
    });
    expect(await new HttpUserDirectory(loadNotificationsConfig(m2mEnv)).findById('u1')).toEqual({
      email: null,
      name: null,
    });
    expect(tokens).toBe(2);
  });

  it('surfaces other HTTP errors', async () => {
    vi.stubGlobal('fetch', async (url: string | URL) =>
      String(url).endsWith('/oidc/token')
        ? json(200, { access_token: 't', expires_in: 3600 })
        : json(500, {}),
    );
    await expect(
      new HttpUserDirectory(loadNotificationsConfig(m2mEnv)).findById('u1'),
    ).rejects.toThrow('500');
  });

  it('cannot be built without M2M credentials', () => {
    expect(() => new HttpUserDirectory(loadNotificationsConfig({}))).toThrow(/LOGTO_M2M/);
  });
});

describe('DevFallbackUserDirectory', () => {
  it('uses the fallback email only outside production', async () => {
    const env = { NOTIFICATIONS_DEV_FALLBACK_EMAIL: 'dev@x.io' };
    expect(await new DevFallbackUserDirectory(loadNotificationsConfig(env)).findById('u1')).toEqual(
      { email: 'dev@x.io', name: null },
    );
    expect(
      await new DevFallbackUserDirectory(
        loadNotificationsConfig({ ...env, NODE_ENV: 'production' }),
      ).findById('u1'),
    ).toBeNull();
  });
});
