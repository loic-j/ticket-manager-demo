import { z } from 'zod';

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

export interface AuthConfig {
  /** Expected `iss` claim: `${LOGTO_ENDPOINT}/oidc`. */
  issuer: string;
  /** Where Logto publishes its signing keys. */
  jwksUri: URL;
  /** Expected `aud` claim: the API resource indicator registered in Logto for this service. */
  audience: string;
}

export interface AuthModuleOptions {
  /** API resource of the service; `LOGTO_API_RESOURCE` overrides it at runtime. */
  defaultAudience: string;
}

const envSchema = z.object({
  LOGTO_ENDPOINT: z.url().default('http://localhost:3301'),
  LOGTO_API_RESOURCE: z.string().min(1).optional(),
});

export function loadAuthConfig(
  options: AuthModuleOptions,
  env: NodeJS.ProcessEnv = process.env,
): AuthConfig {
  const parsed = envSchema.parse(env);
  const endpoint = parsed.LOGTO_ENDPOINT.replace(/\/$/, '');
  return {
    issuer: `${endpoint}/oidc`,
    jwksUri: new URL(`${endpoint}/oidc/jwks`),
    audience: parsed.LOGTO_API_RESOURCE ?? options.defaultAudience,
  };
}
