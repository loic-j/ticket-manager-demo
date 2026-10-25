import { Inject, Injectable } from '@nestjs/common';
import { authUserSchema, type AuthUser } from '@ticketmanager/contracts';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';

/**
 * Signing algorithms Logto can be configured with for access tokens (EC = ES384 by default,
 * RSA = RS256). Anything else, symmetric algorithms in particular, is rejected.
 */
const ALLOWED_ALGORITHMS = ['ES384', 'RS256'];
/** Access tokens are typed `at+jwt` (RFC 9068); an id token presented as a bearer is rejected. */
const ACCESS_TOKEN_TYP = 'at+jwt';
/** Tolerated clock drift between Logto and the service, in seconds. */
const CLOCK_TOLERANCE_S = 5;

/** Maps verified JWT claims to the app's `AuthUser`. */
export function toAuthUser(payload: JWTPayload): AuthUser {
  return authUserSchema.parse({
    sub: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  });
}

/**
 * Verifies Logto access tokens: signature against the remote JWKS (cached by jose), algorithm,
 * token type, issuer, audience and expiry. Tests replace this provider with a verifier backed by
 * a local key pair (`LocalTokenIssuer` in `@ticketmanager/nest-common/testing`).
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
      algorithms: ALLOWED_ALGORITHMS,
      typ: ACCESS_TOKEN_TYP,
      clockTolerance: CLOCK_TOLERANCE_S,
    });
    return toAuthUser(payload);
  }
}
