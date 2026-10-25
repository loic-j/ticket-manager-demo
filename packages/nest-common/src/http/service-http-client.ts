import type { TokenProvider } from './token-provider.js';

export interface ServiceHttpClientOptions {
  /** Base URL of the called service, without trailing slash. */
  baseUrl: string;
  tokens: TokenProvider;
  /** Per-request timeout. Default 5 s. */
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

export interface ServiceRequestInit extends Omit<RequestInit, 'signal'> {
  /** Forwarded as `x-correlation-id` when present. */
  correlationId?: string;
}

/**
 * Outgoing HTTP calls from one service to another: bearer token from the provider, timeout, and
 * a single retry with a fresh token when the callee answers 401 (rotated or revoked token).
 * Returns the raw `Response`; callers map statuses and parse bodies with their Zod schemas.
 */
export class ServiceHttpClient {
  private readonly fetch: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  constructor(private readonly options: ServiceHttpClientOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
  }

  async request(path: string, init: ServiceRequestInit = {}): Promise<Response> {
    const res = await this.send(path, init);
    if (res.status !== 401) return res;
    this.options.tokens.invalidate();
    return this.send(path, init);
  }

  private async send(path: string, init: ServiceRequestInit): Promise<Response> {
    const { correlationId, headers, ...rest } = init;
    const token = await this.options.tokens.getToken();
    const requestHeaders = new Headers(headers);
    requestHeaders.set('authorization', `Bearer ${token}`);
    if (correlationId) requestHeaders.set('x-correlation-id', correlationId);
    return this.fetch(`${this.baseUrl}${path}`, {
      ...rest,
      headers: requestHeaders,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }
}
