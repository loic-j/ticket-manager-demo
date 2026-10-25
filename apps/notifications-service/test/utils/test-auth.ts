import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NOTIFICATIONS_API_RESOURCE } from '@ticketmanager/contracts';
import { JwtVerifier } from '@ticketmanager/nest-common';
import { LocalTokenIssuer, type TokenOptions } from '@ticketmanager/nest-common/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/database/infrastructure/prisma.service.js';
import { TicketEventsConsumer } from '../../src/messaging/presentation/ticket-events.consumer.js';
import {
  MAILER,
  NOTIFICATION_READ_REPOSITORY,
  PROCESSED_EVENTS,
  TICKET_VERSIONS,
  UNIT_OF_WORK,
  USER_DIRECTORY,
} from '../../src/notifications/application/ports/index.js';
import { NOTIFICATION_REPOSITORY } from '../../src/notifications/domain/notification.repository.js';
import {
  CapturingMailer,
  ImmediateUnitOfWork,
  InMemoryNotificationRepository,
  InMemoryProcessedEvents,
  InMemoryTicketVersions,
  StaticUserProfiles,
} from '../../src/notifications/infrastructure/testing.js';

export type { TokenOptions };

/** Local stand-in for Logto plus in-memory ports: e2e tests need no infrastructure at all. */
export class TestAuth {
  readonly notifications = new InMemoryNotificationRepository();
  readonly mailer = new CapturingMailer();

  private constructor(private readonly tokens: LocalTokenIssuer) {}

  static async create(): Promise<TestAuth> {
    return new TestAuth(
      await LocalTokenIssuer.create({ defaultAudience: NOTIFICATIONS_API_RESOURCE }),
    );
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

  /** Boots the full `AppModule` with the global pipe from `main.ts`: no Logto, database or broker. */
  async createApp(): Promise<INestApplication<App>> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JwtVerifier)
      .useValue(this.tokens.verifier)
      .overrideProvider(NOTIFICATION_REPOSITORY)
      .useValue(this.notifications)
      .overrideProvider(NOTIFICATION_READ_REPOSITORY)
      .useValue(this.notifications)
      .overrideProvider(PROCESSED_EVENTS)
      .useValue(new InMemoryProcessedEvents())
      .overrideProvider(TICKET_VERSIONS)
      .useValue(new InMemoryTicketVersions())
      .overrideProvider(UNIT_OF_WORK)
      .useValue(new ImmediateUnitOfWork())
      .overrideProvider(USER_DIRECTORY)
      .useValue(new StaticUserProfiles({ user_test: { email: 'test@example.com', name: null } }))
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
