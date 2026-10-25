import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { TICKETS_API_RESOURCE } from '@ticketmanager/contracts';
import { JwtVerifier } from '@ticketmanager/nest-common';
import { LocalTokenIssuer, type TokenOptions } from '@ticketmanager/nest-common/testing';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/database/infrastructure/prisma.service.js';
import { ImmediateUnitOfWork, InMemoryOutbox } from '../../src/messaging/infrastructure/testing.js';
import { OUTBOX, UNIT_OF_WORK } from '../../src/messaging/application/ports/index.js';
import { TICKET_READ_REPOSITORY } from '../../src/tickets/application/ports/ticket-read.repository.js';
import { TICKET_REPOSITORY } from '../../src/tickets/domain/ticket.repository.js';
import { InMemoryTicketRepository } from '../../src/tickets/infrastructure/testing.js';

export type { TokenOptions };

/**
 * e2e harness of this service: signs tokens with the local stand-in for Logto
 * (`LocalTokenIssuer`) and boots the application with in-memory ports, so e2e tests run without
 * Logto, PostgreSQL or RabbitMQ.
 */
export class TestAuth {
  /** Integration events appended by every application created from this `TestAuth`. */
  readonly outbox = new InMemoryOutbox();

  private constructor(private readonly tokens: LocalTokenIssuer) {}

  static async create(): Promise<TestAuth> {
    return new TestAuth(await LocalTokenIssuer.create({ defaultAudience: TICKETS_API_RESOURCE }));
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

  /** Drop-in replacement for `JwtVerifier` trusting the local public key. */
  get verifier(): Pick<JwtVerifier, 'verify'> {
    return this.tokens.verifier;
  }

  /**
   * Boots the full `AppModule` with the global pipe from `main.ts`, the fake verifier and one
   * in-memory ticket store bound to both ports (commands are visible to queries).
   */
  async createApp(): Promise<INestApplication<App>> {
    const store = new InMemoryTicketRepository();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JwtVerifier)
      .useValue(this.verifier)
      .overrideProvider(TICKET_REPOSITORY)
      .useValue(store)
      .overrideProvider(TICKET_READ_REPOSITORY)
      .useValue(store)
      // Messaging without database: immediate unit of work, captured outbox (no relay here).
      .overrideProvider(UNIT_OF_WORK)
      .useValue(new ImmediateUnitOfWork())
      .overrideProvider(OUTBOX)
      .useValue(this.outbox)
      // Nothing touches the database once the repository is in memory.
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const app = moduleRef.createNestApplication<INestApplication<App>>();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
    return app;
  }
}
