import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { parseEnvelope, type EventEnvelope } from '@ticketmanager/events';
import { PrismaService } from '../../database/prisma.service.js';
import { MESSAGING_CONFIG, type MessagingConfig } from '../messaging.config.js';
import { EVENT_PUBLISHER, type EventPublisher } from '../ports/event-publisher.js';

const TRANSACTION_TIMEOUT_MS = 30_000;

type OutboxRow = { id: string; sequence: bigint; payload: unknown };

/**
 * Polls `outbox_messages`, publishes unpublished rows in `sequence` order and marks them.
 * Runs only in the relay process (`main.relay.ts`), never in the HTTP service.
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
    private readonly prisma: PrismaService,
    @Inject(MESSAGING_CONFIG) private readonly config: MessagingConfig,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), this.config.relayIntervalMs);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.inFlight; // let a running batch finish before Prisma/the broker shut down
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
   * @returns the number of rows published (0 when empty or on failure).
   */
  async drainBatch(now: Date = new Date()): Promise<number> {
    return this.prisma.runInTransaction(
      async () => {
        const tx = this.prisma.db;
        const rows = await tx.$queryRaw<OutboxRow[]>`
          SELECT id, sequence, payload FROM outbox_messages
          WHERE published_at IS NULL AND occurred_at <= ${now}
            AND attempts < ${this.config.maxAttempts}
          ORDER BY sequence
          LIMIT ${this.config.batchSize}
          FOR UPDATE SKIP LOCKED`;
        if (rows.length === 0) return 0;

        const { envelopes, poison } = this.parse(rows);
        for (const { id, error } of poison) {
          await tx.outboxMessage.update({
            where: { id },
            data: { attempts: this.config.maxAttempts, lastError: `unparsable envelope: ${error}` },
          });
          this.logger.error(`Outbox message ${id} quarantined: ${error}`);
        }
        const ids = envelopes.map((e) => e.id);
        if (ids.length === 0) return rows.length;

        try {
          await this.publisher.publish(envelopes);
        } catch (error) {
          const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
          await tx.outboxMessage.updateMany({
            where: { id: { in: ids } },
            data: { attempts: { increment: 1 }, lastError: message },
          });
          this.logger.warn(`Publishing ${ids.length} outbox message(s) failed: ${message}`);
          return 0;
        }
        await tx.outboxMessage.updateMany({
          where: { id: { in: ids } },
          data: { publishedAt: new Date(), lastError: null },
        });
        return rows.length;
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
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
