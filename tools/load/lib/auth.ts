import http from 'k6/http';
import encoding from 'k6/encoding';
import { check } from 'k6';
import { config } from './config.ts';

export interface Tokens {
  tickets: string;
  notifications: string;
}

/** OAuth 2 client_credentials against Logto, one token per API resource (lifetime 1 h by default). */
export function clientCredentials(resource: string): string {
  const res = http.post(
    `${config.logtoEndpoint}/oidc/token`,
    { grant_type: 'client_credentials', resource, scope: config.scope },
    {
      headers: {
        Authorization: `Basic ${encoding.b64encode(`${config.appId}:${config.appSecret}`)}`,
      },
      tags: { name: 'POST logto/oidc/token' },
    },
  );
  const ok = check(res, { 'token issued': (r) => r.status === 200 });
  if (!ok) {
    throw new Error(`Logto refused the token request for ${resource}: ${res.status} ${res.body}`);
  }
  return res.json('access_token') as string;
}

/** Called from `setup()`: the tokens are passed to every VU as the setup data. */
export function issueTokens(): Tokens {
  return {
    tickets: clientCredentials(config.resources.tickets),
    notifications: clientCredentials(config.resources.notifications),
  };
}
