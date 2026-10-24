import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { generateKeyPair, jwtVerify, SignJWT, type CryptoKey } from 'jose';
import type { App } from 'supertest/types.js';
import { TICKETS_API_RESOURCE } from '@ticketmanager/contracts';
import { JwtVerifier, loadAuthConfig, toAuthUser } from '@ticketmanager/nest-common';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { OutboxRelay } from '../../src/messaging/infrastructure/outbox-relay.js';
import {
  CapturingEventPublisher,
  ImmediateUnitOfWork,
  InMemoryOutbox,
} from '../../src/messaging/infrastructure/testing.js';
import { EVENT_PUBLISHER, OUTBOX, UNIT_OF_WORK } from '../../src/messaging/ports/index.js';
import { TICKET_READ_REPOSITORY } from '../../src/tickets/application/ports/ticket-read.repository.js';
import { TICKET_REPOSITORY } from '../../src/tickets/domain/ticket.repository.js';
import { InMemoryTicketRepository } from '../../src/tickets/infrastructure/in-memory-ticket.repository.js';

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
  /** Integration events appended by the last `createApp()` instance. */
  readonly outbox = new InMemoryOutbox();

  private constructor(
    private readonly privateKey: CryptoKey,
    private readonly publicKey: CryptoKey,
    readonly issuer: string,
    readonly audience: string,
  ) {}

  static async create(): Promise<TestAuth> {
    const { issuer, audience } = loadAuthConfig({ defaultAudience: TICKETS_API_RESOURCE });
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

  /**
   * Boots the full `AppModule` with the global pipe from `main.ts`, this fake verifier and an
   * in-memory ticket store, so e2e tests need neither Logto nor PostgreSQL.
   */
  async createApp(): Promise<INestApplication<App>> {
    // One in-memory instance for both ports so commands are visible to queries.
    const store = new InMemoryTicketRepository();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JwtVerifier)
      .useValue(this.verifier)
      .overrideProvider(TICKET_REPOSITORY)
      .useValue(store)
      .overrideProvider(TICKET_READ_REPOSITORY)
      .useValue(store)
      // Messaging without database or broker: immediate unit of work, captured outbox, no relay.
      .overrideProvider(UNIT_OF_WORK)
      .useValue(new ImmediateUnitOfWork())
      .overrideProvider(OUTBOX)
      .useValue(this.outbox)
      .overrideProvider(EVENT_PUBLISHER)
      .useValue(new CapturingEventPublisher())
      .overrideProvider(OutboxRelay)
      .useValue({})
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
