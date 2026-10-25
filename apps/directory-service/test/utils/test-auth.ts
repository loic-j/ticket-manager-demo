import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DIRECTORY_API_RESOURCE } from '@ticketmanager/contracts';
import { JwtVerifier, loadAuthConfig, toAuthUser } from '@ticketmanager/nest-common';
import { generateKeyPair, jwtVerify, SignJWT, type CryptoKey } from 'jose';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { USER_DIRECTORY } from '../../src/users/application/ports/index.js';
import { StaticUserDirectory, user } from '../../src/users/infrastructure/testing.js';

const ALG = 'ES256';

export interface TokenOptions {
  sub?: string;
  audience?: string;
  issuer?: string;
  expiresIn?: string;
}

/** Local stand-in for Logto plus a static directory: e2e tests need no infrastructure at all. */
export class TestAuth {
  readonly directory = new StaticUserDirectory([user('u1', 'Alice'), user('u2', null)]);

  private constructor(
    private readonly privateKey: CryptoKey,
    private readonly publicKey: CryptoKey,
    readonly issuer: string,
    readonly audience: string,
  ) {}

  static async create(): Promise<TestAuth> {
    const { issuer, audience } = loadAuthConfig({ defaultAudience: DIRECTORY_API_RESOURCE });
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

  async createApp(): Promise<INestApplication<App>> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JwtVerifier)
      .useValue(this.verifier)
      .overrideProvider(USER_DIRECTORY)
      .useValue(this.directory)
      .compile();

    const app = moduleRef.createNestApplication<INestApplication<App>>();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
    return app;
  }
}
