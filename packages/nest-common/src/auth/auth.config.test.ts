import { describe, expect, it } from 'vitest';
import { loadAuthConfig } from './auth.config.js';

describe('loadAuthConfig', () => {
  it('derives issuer and JWKS from the endpoint and falls back to the default audience', () => {
    const config = loadAuthConfig(
      { defaultAudience: 'https://svc.local' },
      { LOGTO_ENDPOINT: 'http://logto:3301/' },
    );
    expect(config.issuer).toBe('http://logto:3301/oidc');
    expect(config.jwksUri.href).toBe('http://logto:3301/oidc/jwks');
    expect(config.audience).toBe('https://svc.local');
  });

  it('lets LOGTO_API_RESOURCE override the audience', () => {
    const config = loadAuthConfig(
      { defaultAudience: 'https://svc.local' },
      { LOGTO_API_RESOURCE: 'https://other.local' },
    );
    expect(config.audience).toBe('https://other.local');
  });
});
