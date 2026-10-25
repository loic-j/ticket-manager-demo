import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DIRECTORY_API_RESOURCE } from '@ticketmanager/contracts';
import { JwtVerifier } from '@ticketmanager/nest-common';
import { LocalTokenIssuer, type TokenOptions } from '@ticketmanager/nest-common/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { USER_DIRECTORY } from '../../src/users/application/ports/index.js';
import { StaticUserDirectory, user } from '../../src/users/infrastructure/testing.js';

export type { TokenOptions };

/** Local stand-in for Logto plus a static directory: e2e tests need no infrastructure at all. */
export class TestAuth {
  readonly directory = new StaticUserDirectory([user('u1', 'Alice'), user('u2', null)]);

  private constructor(private readonly tokens: LocalTokenIssuer) {}

  static async create(): Promise<TestAuth> {
    return new TestAuth(await LocalTokenIssuer.create({ defaultAudience: DIRECTORY_API_RESOURCE }));
  }

  get issuer(): string {
    return this.tokens.issuer;
  }

  get audience(): string {
    return this.tokens.audience;
  }

  token(options?: TokenOptions): Promise<string> {
    return this.tokens.token(options);
  }

  bearer(options?: TokenOptions): Promise<string> {
    return this.tokens.bearer(options);
  }

  /** Boots the full `AppModule` with the global pipe from `main.ts`: no Logto, no network. */
  async createApp(): Promise<INestApplication<App>> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JwtVerifier)
      .useValue(this.tokens.verifier)
      .overrideProvider(USER_DIRECTORY)
      .useValue(this.directory)
      .compile();

    const app = moduleRef.createNestApplication<INestApplication<App>>();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
    return app;
  }
}
