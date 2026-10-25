import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { OUTBOX_RELAY_CONFIG, type OutboxRelayConfig } from './outbox-relay.config.js';

/**
 * Connection pool of the relay to the producing service's database. Plain `pg`, no ORM: the
 * relay only knows the `outbox_messages` table (see `sql/outbox_messages.sql`).
 */
@Injectable()
export class OutboxDatabase implements OnModuleDestroy {
  readonly pool: pg.Pool;

  constructor(@Inject(OUTBOX_RELAY_CONFIG) config: Pick<OutboxRelayConfig, 'databaseUrl'>) {
    this.pool = new pg.Pool({ connectionString: config.databaseUrl });
  }

  onModuleDestroy(): Promise<void> {
    return this.pool.end();
  }
}
