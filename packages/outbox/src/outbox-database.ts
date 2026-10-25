import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { OUTBOX_RELAY_CONFIG, type OutboxRelayConfig } from './outbox-relay.config.js';

/**
 * Connection pool of the relay to the producing service's database. Plain `pg`, no ORM: the
 * relay only knows the `outbox_messages` table (see `sql/outbox_messages.sql`).
 */
@Injectable()
export class OutboxDatabase implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxDatabase.name);
  readonly pool: pg.Pool;

  constructor(@Inject(OUTBOX_RELAY_CONFIG) config: Pick<OutboxRelayConfig, 'databaseUrl'>) {
    this.pool = new pg.Pool({ connectionString: config.databaseUrl });
    // An idle connection dropped by the server (restart, timeout) is reported here; without a
    // listener the event would be an uncaught error and crash the process.
    this.pool.on('error', (error: Error) => {
      this.logger.warn(`Idle database connection error: ${error.message}`);
    });
  }

  onModuleDestroy(): Promise<void> {
    return this.pool.end();
  }
}
