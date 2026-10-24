import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NOTIFICATIONS_API_RESOURCE } from '@ticketmanager/contracts';
import { JwtVerifier, loadAuthConfig, toAuthUser } from '@ticketmanager/nest-common';
import { generateKeyPair, jwtVerify, SignJWT, type CryptoKey } from 'jose';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { TicketEventsConsumer } from '../../src/messaging/ticket-events.consumer.js';
import {
  MAILER,
  NOTIFICATION_READ_REPOSITORY,
  PROCESSED_EVENTS,
  UNIT_OF_WORK,
  USER_DIRECTORY,
} from '../../src/notifications/application/ports/index.js';
import { NOTIFICATION_REPOSITORY } from '../../src/notifications/domain/notification.repository.js';
import {
  CapturingMailer,
  ImmediateUnitOfWork,
  InMemoryNotificationRepository,
  InMemoryProcessedEvents,
  StaticUserDirectory,
} from '../../src/notifications/infrastructure/testing.js';

const ALG = 'ES256';

export interface TokenOptions {
  sub?: string;
  audience?: string;
  issuer?: string;
  expiresIn?: string;
}

/** Local stand-in for Logto plus in-memory ports: e2e tests need no infrastructure at all. */
export class TestAuth {
  readonly notifications = new InMemoryNotificationRepository();
  readonly mailer = new CapturingMailer();

  private constructor(
    private readonly privateKey: CryptoKey,
    private readonly publicKey: CryptoKey,
    readonly issuer: string,
    readonly audience: string,
  ) {}

  static async create(): Promise<TestAuth> {
    const { issuer, audience } = loadAuthConfig({ defaultAudience: NOTIFICATIONS_API_RESOURCE });
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
      .overrideProvider(NOTIFICATION_REPOSITORY)
      .useValue(this.notifications)
      .overrideProvider(NOTIFICATION_READ_REPOSITORY)
      .useValue(this.notifications)
      .overrideProvider(PROCESSED_EVENTS)
      .useValue(new InMemoryProcessedEvents())
      .overrideProvider(UNIT_OF_WORK)
      .useValue(new ImmediateUnitOfWork())
      .overrideProvider(USER_DIRECTORY)
      .useValue(new StaticUserDirectory({ user_test: { email: 'test@example.com', name: null } }))
      .overrideProvider(MAILER)
      .useValue(this.mailer)
      .overrideProvider(TicketEventsConsumer)
      .useValue({})
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const app = moduleRef.createNestApplication<INestApplication<App>>();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
    return app;
  }
}
