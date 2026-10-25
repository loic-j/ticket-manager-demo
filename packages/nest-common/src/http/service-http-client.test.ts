import { describe, expect, it, vi } from 'vitest';
import { ServiceHttpClient } from './service-http-client.js';
import type { TokenProvider } from './token-provider.js';

function tokens(): TokenProvider & { invalidate: ReturnType<typeof vi.fn<() => void>> } {
  let n = 0;
  return {
    getToken: async () => `token-${++n}`,
    invalidate: vi.fn<() => void>(),
  };
}

describe('ServiceHttpClient', () => {
  it('prefixes the base URL, injects the bearer token and keeps the caller headers', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    const client = new ServiceHttpClient({ baseUrl: 'http://svc:3003/', tokens: tokens(), fetch });

    const res = await client.request('/users/u1', { headers: { accept: 'application/json' } });

    expect(res.status).toBe(200);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://svc:3003/users/u1');
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer token-1');
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.has('x-correlation-id')).toBe(false);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('forwards the correlation id when given', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    const client = new ServiceHttpClient({ baseUrl: 'http://svc', tokens: tokens(), fetch });
    await client.request('/x', { correlationId: 'corr-1' });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get('x-correlation-id')).toBe('corr-1');
  });

  it('retries once with a fresh token on 401 and returns the second response as is', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 401 }));
    const provider = tokens();
    const client = new ServiceHttpClient({ baseUrl: 'http://svc', tokens: provider, fetch });

    const res = await client.request('/x');

    expect(res.status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(provider.invalidate).toHaveBeenCalledTimes(1);
    const second = fetch.mock.calls[1] as unknown as [string, RequestInit];
    expect(new Headers(second[1].headers).get('authorization')).toBe('Bearer token-2');
  });

  it('does not retry other statuses', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 500 }));
    const client = new ServiceHttpClient({ baseUrl: 'http://svc', tokens: tokens(), fetch });
    expect((await client.request('/x')).status).toBe(500);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
