import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { TICKETS_API_RESOURCE } from '@ticketmanager/contracts';
import { JwtVerifier } from '@ticketmanager/nest-common';
import { LocalTokenIssuer, type TokenOptions } from '@ticketmanager/nest-common/testing';
import { AppModule } from '../../src/app.module.js';
import { CACHE_STORE } from '../../src/caching/application/ports/index.js';
import { InMemoryCacheStore } from '../../src/caching/infrastructure/testing.js';
import { PrismaService } from '../../src/database/infrastructure/prisma.service.js';
import { ImmediateUnitOfWork, InMemoryOutbox } from '../../src/messaging/infrastructure/testing.js';
import { OUTBOX, UNIT_OF_WORK } from '../../src/messaging/application/ports/index.js';
import { TICKET_READ_REPOSITORY } from '../../src/tickets/application/ports/ticket-read.repository.js';
import { TICKET_REPOSITORY } from '../../src/tickets/domain/ticket.repository.js';
import { CacheStoreTicketCache } from '../../src/tickets/infrastructure/cache-store-ticket-cache.js';
import { CachingTicketReadRepository } from '../../src/tickets/infrastructure/caching-ticket-read.repository.js';
import { InMemoryTicketRepository } from '../../src/tickets/infrastructure/testing.js';
import { TICKET_CACHE } from '../../src/tickets/application/ports/ticket-cache.js';

export type { TokenOptions };

/**
 * e2e harness of this service: signs tokens with the local stand-in for Logto
 * (`LocalTokenIssuer`) and boots the application with in-memory ports, so e2e tests run without
 * Logto, PostgreSQL or RabbitMQ.
 */
export class TestAuth {
  /** Integration events appended by every application created from this `TestAuth`. */
  readonly outbox = new InMemoryOutbox();
  /** Read cache of the last application created (in memory: no Valkey in e2e). */
  cacheStore = new InMemoryCacheStore();

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
   * in-memory ticket store bound to both ports (commands are visible to queries), the read side
   * going through the real cache-aside decorator over an in-memory cache store.
   */
  async createApp(): Promise<INestApplication<App>> {
    const store = new InMemoryTicketRepository();
    this.cacheStore = new InMemoryCacheStore();
    const cache = new CacheStoreTicketCache(this.cacheStore, { ttlMs: 60_000 });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JwtVerifier)
      .useValue(this.verifier)
      .overrideProvider(TICKET_REPOSITORY)
      .useValue(store)
      .overrideProvider(TICKET_READ_REPOSITORY)
      .useValue(new CachingTicketReadRepository(store, cache))
      .overrideProvider(TICKET_CACHE)
      .useValue(cache)
      .overrideProvider(CACHE_STORE)
      .useValue(this.cacheStore)
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
