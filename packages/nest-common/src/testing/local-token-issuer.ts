import { generateKeyPair, jwtVerify, SignJWT, type CryptoKey } from 'jose';
import { loadAuthConfig, type AuthModuleOptions } from '../auth/auth.config.js';
import { toAuthUser, type JwtVerifier } from '../auth/jwt-verifier.js';

const ALG = 'ES384';

export interface TokenOptions {
  sub?: string;
  audience?: string;
  issuer?: string;
  expiresIn?: string;
}

/**
 * Local stand-in for Logto used by the e2e tests of every service: a key pair generated per test
 * file, tokens signed with the private key, and a `JwtVerifier` replacement that trusts the
 * public key (same issuer / audience / algorithm / `typ` checks as the real one). Each service
 * wraps it in its own `TestAuth` that builds the application with in-memory ports.
 */
export class LocalTokenIssuer {
  private constructor(
    private readonly privateKey: CryptoKey,
    private readonly publicKey: CryptoKey,
    readonly issuer: string,
    readonly audience: string,
  ) {}

  /** Issuer and audience come from `loadAuthConfig`, exactly like the service under test. */
  static async create(options: AuthModuleOptions): Promise<LocalTokenIssuer> {
    const { issuer, audience } = loadAuthConfig(options);
    const { privateKey, publicKey } = await generateKeyPair(ALG);
    return new LocalTokenIssuer(privateKey, publicKey, issuer, audience);
  }

  token(options: TokenOptions = {}): Promise<string> {
    return new SignJWT({ scope: '' })
      .setProtectedHeader({ alg: ALG, typ: 'at+jwt' })
      .setIssuer(options.issuer ?? this.issuer)
      .setAudience(options.audience ?? this.audience)
      .setSubject(options.sub ?? 'user_test')
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? '5m')
      .sign(this.privateKey);
  }

  async bearer(options?: TokenOptions): Promise<string> {
    return `Bearer ${await this.token(options)}`;
  }

  /** Drop-in replacement for `JwtVerifier` trusting the local public key. */
  get verifier(): Pick<JwtVerifier, 'verify'> {
    return {
      verify: async (token) => {
        const { payload } = await jwtVerify(token, this.publicKey, {
          issuer: this.issuer,
          audience: this.audience,
          algorithms: [ALG],
          typ: 'at+jwt',
        });
        return toAuthUser(payload);
      },
    };
  }
}
