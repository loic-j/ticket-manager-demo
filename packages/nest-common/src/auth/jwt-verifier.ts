import { Inject, Injectable } from '@nestjs/common';
import { authUserSchema, type AuthUser } from '@ticketmanager/contracts';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';

/** Maps verified JWT claims to the app's `AuthUser`. */
export function toAuthUser(payload: JWTPayload): AuthUser {
  return authUserSchema.parse({
    sub: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  });
}

/**
 * Verifies Logto access tokens: signature against the remote JWKS, issuer, audience, expiry.
 * Tests replace this provider with a verifier backed by a local key pair.
 */
@Injectable()
export class JwtVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {
    this.jwks = createRemoteJWKSet(config.jwksUri);
  }

  async verify(token: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
    return toAuthUser(payload);
  }
}
