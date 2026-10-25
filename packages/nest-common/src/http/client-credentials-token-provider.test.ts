import { describe, expect, it, vi } from 'vitest';
import {
  ClientCredentialsTokenProvider,
  TokenRequestError,
  logtoClientCredentials,
} from './client-credentials-token-provider.js';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function provider(fetch: typeof globalThis.fetch, now = () => 1_000_000) {
  return new ClientCredentialsTokenProvider({
    tokenEndpoint: 'http://logto/oidc/token',
    appId: 'app',
    appSecret: 'secret',
    resource: 'https://svc.local',
    scope: 'read:users',
    fetch,
    now,
  });
}

describe('ClientCredentialsTokenProvider', () => {
  it('posts a client_credentials form with Basic auth and parses the token', async () => {
    const fetch = vi.fn(async () => json(200, { access_token: 't1', expires_in: 3600 }));
    const token = await provider(fetch).getToken();

    expect(token).toBe('t1');
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://logto/oidc/token');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('authorization')).toBe(
      `Basic ${Buffer.from('app:secret').toString('base64')}`,
    );
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      grant_type: 'client_credentials',
      resource: 'https://svc.local',
      scope: 'read:users',
    });
  });

  it('reuses the token until it is about to expire and shares one in-flight request', async () => {
    let clock = 0;
    const fetch = vi.fn(async () =>
      json(200, { access_token: `t${fetch.mock.calls.length}`, expires_in: 100 }),
    );
    const tokens = provider(fetch, () => clock);

    const [a, b] = await Promise.all([tokens.getToken(), tokens.getToken()]);
    expect(a).toBe(b);
    expect(fetch).toHaveBeenCalledTimes(1);

    clock = 50_000; // still 50 s of validity left, more than the 30 s skew
    expect(await tokens.getToken()).toBe(a);
    expect(fetch).toHaveBeenCalledTimes(1);

    clock = 75_000; // 25 s left: refresh
    expect(await tokens.getToken()).not.toBe(a);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('fetches a new token after invalidate()', async () => {
    const fetch = vi.fn(async () => json(200, { access_token: 't', expires_in: 3600 }));
    const tokens = provider(fetch);
    await tokens.getToken();
    tokens.invalidate();
    await tokens.getToken();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects with TokenRequestError on a non-2xx answer and does not cache', async () => {
    const fetch = vi.fn(async () => json(401, { error: 'invalid_client' }));
    const tokens = provider(fetch);
    await expect(tokens.getToken()).rejects.toBeInstanceOf(TokenRequestError);
    await expect(tokens.getToken()).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('logtoClientCredentials derives the token endpoint from the Logto endpoint', async () => {
    const fetch = vi.fn(async () => json(200, { access_token: 't', expires_in: 3600 }));
    await logtoClientCredentials({
      endpoint: 'http://localhost:3301/',
      appId: 'a',
      appSecret: 's',
      resource: 'r',
      fetch,
    }).getToken();
    const [url] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:3301/oidc/token');
  });

  it('rejects a token answer with a non-positive expires_in', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ access_token: 't', expires_in: 0 }), { status: 200 }),
    );
    const provider = new ClientCredentialsTokenProvider({
      tokenEndpoint: 'http://logto/oidc/token',
      appId: 'a',
      appSecret: 's',
      resource: 'https://svc.local',
      fetch,
    });
    await expect(provider.getToken()).rejects.toThrow();
  });
});
