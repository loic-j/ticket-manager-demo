import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { parseEnvelope, type EventEnvelope } from '@ticketmanager/events';
import type pg from 'pg';
import { EVENT_PUBLISHER, type EventPublisher } from './event-publisher.js';
import { OutboxDatabase } from './outbox-database.js';
import { OUTBOX_RELAY_CONFIG, type OutboxRelayConfig } from './outbox-relay.config.js';

/** Upper bound of every statement of a batch; the broker wait is bounded separately. */
const STATEMENT_TIMEOUT_MS = 30_000;

type RelayConfig = Pick<OutboxRelayConfig, 'relayIntervalMs' | 'batchSize' | 'maxAttempts'>;
type OutboxRow = { id: string; payload: unknown };

/**
 * Polls `outbox_messages`, publishes unpublished rows in `sequence` order and marks them.
 * Several relay instances can run at once: `FOR UPDATE SKIP LOCKED` hands each one a distinct
 * batch. Publication order is therefore best-effort only; consumers rely on the aggregate
 * `version` carried by every event, not on delivery order.
 * Delivery is at-least-once (a crash between publish and mark republishes the batch), so
 * consumers deduplicate on the envelope id. Rows that cannot be parsed or that failed
 * `maxAttempts` times stay in the table with `last_error` and are skipped.
 */
@Injectable()
export class OutboxRelay implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<void>;

  constructor(
    private readonly db: OutboxDatabase,
    @Inject(OUTBOX_RELAY_CONFIG) private readonly config: RelayConfig,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
  ) {}

  onModuleInit(): void {
    // The timer keeps the (otherwise idle) relay process alive; `onModuleDestroy` clears it.
    this.timer = setInterval(() => void this.tick(), this.config.relayIntervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.inFlight; // let a running batch finish before the pool and the broker shut down
  }

  private tick(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.drainAll().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  /** Drains until the table is empty or a batch fails, so bursts do not wait for the timer. */
  private async drainAll(): Promise<void> {
    try {
      while ((await this.drainBatch()) === this.config.batchSize);
    } catch (error) {
      this.logger.error(`Outbox relay tick failed: ${String(error)}`);
    }
  }

  /**
   * Publishes one batch of events that occurred at or before `now`.
   * @returns the number of rows handled (0 when empty or when the broker rejected the batch).
   */
  async drainBatch(now: Date = new Date()): Promise<number> {
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
      const handled = await this.publishBatch(client, now);
      await client.query('COMMIT');
      return handled;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async publishBatch(client: pg.PoolClient, now: Date): Promise<number> {
    const { rows } = await client.query<OutboxRow>(
      `SELECT id, payload FROM outbox_messages
       WHERE published_at IS NULL
         AND occurred_at <= ($1::timestamptz AT TIME ZONE 'UTC')
         AND attempts < $2
       ORDER BY sequence
       LIMIT $3
       FOR UPDATE SKIP LOCKED`,
      [now.toISOString(), this.config.maxAttempts, this.config.batchSize],
    );
    if (rows.length === 0) return 0;

    const { envelopes, poison } = this.parse(rows);
    for (const { id, error } of poison) {
      await client.query(
        `UPDATE outbox_messages SET attempts = $2, last_error = $3 WHERE id = $1`,
        [id, this.config.maxAttempts, `unparsable envelope: ${error}`],
      );
      this.logger.error(`Outbox message ${id} quarantined: ${error}`);
    }
    const ids = envelopes.map((e) => e.id);
    if (ids.length === 0) return rows.length;

    try {
      await this.publisher.publish(envelopes);
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
      await client.query(
        `UPDATE outbox_messages SET attempts = attempts + 1, last_error = $2
         WHERE id = ANY($1::uuid[])`,
        [ids, message],
      );
      this.logger.warn(`Publishing ${ids.length} outbox message(s) failed: ${message}`);
      return 0;
    }
    await client.query(
      `UPDATE outbox_messages SET published_at = (now() AT TIME ZONE 'UTC'), last_error = NULL
       WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    return rows.length;
  }

  private parse(rows: OutboxRow[]): {
    envelopes: EventEnvelope[];
    poison: { id: string; error: string }[];
  } {
    const envelopes: EventEnvelope[] = [];
    const poison: { id: string; error: string }[] = [];
    for (const row of rows) {
      try {
        envelopes.push(parseEnvelope(row.payload));
      } catch (error) {
        poison.push({ id: row.id, error: String(error).slice(0, 500) });
      }
    }
    return { envelopes, poison };
  }
}
