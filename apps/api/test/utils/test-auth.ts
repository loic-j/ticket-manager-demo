import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { generateKeyPair, jwtVerify, SignJWT, type CryptoKey } from 'jose';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { loadAuthConfig } from '../../src/auth/auth.config.js';
import { JwtVerifier, toAuthUser } from '../../src/auth/jwt-verifier.js';

const ALG = 'ES256';

export interface TokenOptions {
  sub?: string;
  audience?: string;
  issuer?: string;
  expiresIn?: string;
}

/**
 * Local stand-in for Logto: a key pair generated per test file. Tokens are signed with the
 * private key and `JwtVerifier` is replaced by one that trusts the public key, so e2e tests
 * run without Logto or Docker.
 */
export class TestAuth {
  private constructor(
    private readonly privateKey: CryptoKey,
    private readonly publicKey: CryptoKey,
    readonly issuer: string,
    readonly audience: string,
  ) {}

  static async create(): Promise<TestAuth> {
    const { issuer, audience } = loadAuthConfig();
    const { privateKey, publicKey } = await generateKeyPair(ALG);
    return new TestAuth(privateKey, publicKey, issuer, audience);
  }

  token(options: TokenOptions = {}): Promise<string> {
    return new SignJWT({ scope: '' })
      .setProtectedHeader({ alg: ALG })
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
        });
        return toAuthUser(payload);
      },
    };
  }

  /** Boots the full `AppModule` with the global pipe from `main.ts` and this fake verifier. */
  async createApp(): Promise<INestApplication<App>> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JwtVerifier)
      .useValue(this.verifier)
      .compile();

    const app = moduleRef.createNestApplication<INestApplication<App>>();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
    return app;
  }
}
