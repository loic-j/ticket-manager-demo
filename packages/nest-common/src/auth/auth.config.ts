import { API_RESOURCE_INDICATOR } from '@ticketmanager/shared';
import { z } from 'zod';

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

export interface AuthConfig {
  /** Expected `iss` claim: `${LOGTO_ENDPOINT}/oidc`. */
  issuer: string;
  /** Where Logto publishes its signing keys. */
  jwksUri: URL;
  /** Expected `aud` claim: the API resource indicator registered in Logto. */
  audience: string;
}

const envSchema = z.object({
  LOGTO_ENDPOINT: z.url().default('http://localhost:3301'),
  LOGTO_API_RESOURCE: z.string().min(1).default(API_RESOURCE_INDICATOR),
});

export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const parsed = envSchema.parse(env);
  const endpoint = parsed.LOGTO_ENDPOINT.replace(/\/$/, '');
  return {
    issuer: `${endpoint}/oidc`,
    jwksUri: new URL(`${endpoint}/oidc/jwks`),
    audience: parsed.LOGTO_API_RESOURCE,
  };
}
