import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../../generated/prisma/client.js';

/** Client usable inside or outside a transaction (models + raw queries, no `$transaction`). */
export type DbClient = Prisma.TransactionClient;

/**
 * Single Prisma client for the notifications database, wrapped (not extended: Prisma returns a Proxy
 * from its constructor, which breaks getters on subclasses). Connects lazily on first query.
 *
 * `db` returns the transaction client of the ambient `runInTransaction()` call when there is
 * one, otherwise the root client; adapters must always go through it so that a unit of work can
 * span several adapters (aggregate + outbox) without passing a transaction object around.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient;
  private readonly transactions = new AsyncLocalStorage<DbClient>();

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set (see apps/notifications-service/.env.example)');
    }
    this.client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }

  get db(): DbClient {
    return this.transactions.getStore() ?? this.client;
  }

  /** Runs `work` in one database transaction; nested calls join the ambient transaction. */
  runInTransaction<T>(work: () => Promise<T>, options?: { timeout?: number }): Promise<T> {
    if (this.transactions.getStore()) {
      return work();
    }
    return this.client.$transaction((tx) => this.transactions.run(tx, work), options);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
