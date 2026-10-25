import { z } from 'zod';
import type { TokenProvider } from './token-provider.js';

export interface ClientCredentialsOptions {
  /** OAuth 2 token endpoint, e.g. `${LOGTO_ENDPOINT}/oidc/token`. */
  tokenEndpoint: string;
  appId: string;
  appSecret: string;
  /** API resource indicator the token is requested for (`aud` of the issued token). */
  resource: string;
  /** Space-separated scopes to request. */
  scope?: string;
  /** Default 5 s. */
  timeoutMs?: number;
  /** A token is refreshed when it expires within this window. Default 30 s. */
  refreshSkewMs?: number;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}

export class TokenRequestError extends Error {
  constructor(readonly status: number) {
    super(`Client credentials token request failed: ${status}`);
    this.name = 'TokenRequestError';
  }
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number(),
});

/**
 * OAuth 2 `client_credentials` grant with an in-memory cache: the token is reused until it is
 * about to expire and concurrent callers share a single in-flight request.
 */
export class ClientCredentialsTokenProvider implements TokenProvider {
  private token?: { value: string; expiresAt: number };
  private inFlight?: Promise<string>;
  private readonly fetch: typeof globalThis.fetch;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly refreshSkewMs: number;

  constructor(private readonly options: ClientCredentialsOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.refreshSkewMs = options.refreshSkewMs ?? 30_000;
  }

  getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now() + this.refreshSkewMs) {
      return Promise.resolve(this.token.value);
    }
    this.inFlight ??= this.request().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  invalidate(): void {
    this.token = undefined;
  }

  private async request(): Promise<string> {
    const { tokenEndpoint, appId, appSecret, resource, scope } = this.options;
    const body = new URLSearchParams({ grant_type: 'client_credentials', resource });
    if (scope) body.set('scope', scope);
    const res = await this.fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
      },
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new TokenRequestError(res.status);
    const token = tokenResponseSchema.parse(await res.json());
    this.token = { value: token.access_token, expiresAt: this.now() + token.expires_in * 1000 };
    return token.access_token;
  }
}

export interface LogtoClientCredentialsOptions extends Omit<
  ClientCredentialsOptions,
  'tokenEndpoint'
> {
  /** Logto endpoint, e.g. `http://localhost:3301`. */
  endpoint: string;
}

/** `ClientCredentialsTokenProvider` against a Logto instance (`<endpoint>/oidc/token`). */
export function logtoClientCredentials(
  options: LogtoClientCredentialsOptions,
): ClientCredentialsTokenProvider {
  const { endpoint, ...rest } = options;
  return new ClientCredentialsTokenProvider({
    ...rest,
    tokenEndpoint: `${endpoint.replace(/\/$/, '')}/oidc/token`,
  });
}
