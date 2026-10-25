import { randomUUID } from 'node:crypto';
import { ticketCreatedV1, type EventEnvelope } from '@ticketmanager/events';
import amqp from 'amqplib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OutboxDatabase } from '../src/outbox-database.js';
import { loadOutboxRelayConfig } from '../src/outbox-relay.config.js';
import { OutboxRelay } from '../src/outbox-relay.js';
import { RabbitMqEventPublisher } from '../src/rabbitmq-event-publisher.js';

/**
 * Needs a database holding `outbox_messages` and RabbitMQ (`pnpm infra:up`; defaults target
 * tickets-db). Uses a throwaway queue bound to `ticket.#`.
 */
describe('OutboxRelay (integration)', () => {
  const config = loadOutboxRelayConfig({
    DATABASE_URL: 'postgresql://tickets:tickets@localhost:5433/tickets',
    ...process.env,
  });
  const db = new OutboxDatabase(config);
  const publisher = new RabbitMqEventPublisher(config);
  const relay = new OutboxRelay(db, { ...config, batchSize: 2 }, publisher);
  let connection: amqp.ChannelModel;
  let queue: string;
  const ids: string[] = [];
  // Rows are dated in the future so a relay running elsewhere (e.g. `pnpm dev` against the
  // same database) ignores them; this test's relay drains with a later `now`.
  const inOneHour = Date.now() + 60 * 60 * 1000;
  const later = new Date(inOneHour + 60 * 60 * 1000);

  const ticket = (title: string) => ({
    id: randomUUID(),
    title,
    description: '',
    status: 'open' as const,
    priority: 'low' as const,
    createdBy: 'user_int',
    updatedBy: 'user_int',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const created = (title: string, occurredAt: Date) =>
    ticketCreatedV1.create({ ticket: ticket(title) }, { occurredAt: occurredAt.toISOString() });

  /** What a producing service's write side does inside its own transaction. */
  async function append(rows: { id: string; payload: unknown; occurredAt: Date }[]) {
    for (const row of rows) {
      ids.push(row.id);
      await db.pool.query(
        `INSERT INTO outbox_messages (id, type, version, aggregate_type, aggregate_id, payload, occurred_at)
         VALUES ($1, 'ticket.created', 1, 'ticket', $2, $3, ($4::timestamptz AT TIME ZONE 'UTC'))`,
        [row.id, randomUUID(), JSON.stringify(row.payload), row.occurredAt.toISOString()],
      );
    }
  }
  const stored = async (id: string) => {
    const { rows } = await db.pool.query<{
      published_at: Date | null;
      attempts: number;
      last_error: string | null;
    }>('SELECT published_at, attempts, last_error FROM outbox_messages WHERE id = $1', [id]);
    return rows[0]!;
  };

  beforeAll(async () => {
    connection = await amqp.connect(config.rabbitmqUrl);
    const channel = await connection.createChannel();
    await channel.assertExchange(config.exchange, 'topic', { durable: true });
    ({ queue } = await channel.assertQueue('', { exclusive: true }));
    await channel.bindQueue(queue, config.exchange, 'ticket.#');
    await channel.close();
  });

  afterAll(async () => {
    await db.pool.query('DELETE FROM outbox_messages WHERE id = ANY($1::uuid[])', [ids]);
    await publisher.onModuleDestroy();
    await connection.close();
    await db.onModuleDestroy();
  });

  it('publishes outbox rows in order, marks them, and republishes nothing afterwards', async () => {
    const envelopes = [1, 2, 3].map((n) => created(`Outbox ${n}`, new Date(inOneHour + n * 1000)));
    await append(
      envelopes.map((e) => ({ id: e.id, payload: e, occurredAt: new Date(e.occurredAt) })),
    );

    // batchSize = 2: first drain publishes 2, second publishes 1, third finds nothing.
    expect(await relay.drainBatch(later)).toBe(2);
    expect(await relay.drainBatch(later)).toBe(1);
    expect(await relay.drainBatch(later)).toBe(0);

    for (const e of envelopes) {
      expect(await stored(e.id)).toMatchObject({ attempts: 0, last_error: null });
      expect((await stored(e.id)).published_at).not.toBeNull();
    }

    const channel = await connection.createChannel();
    const received: EventEnvelope[] = [];
    for (let i = 0; i < 20 && received.length < 3; i++) {
      const msg = await channel.get(queue, { noAck: true });
      if (msg) received.push(JSON.parse(msg.content.toString()) as EventEnvelope);
      else await new Promise((r) => setTimeout(r, 100));
    }
    await channel.close();
    expect(received.map((e) => e.id)).toEqual(envelopes.map((e) => e.id));
    expect(ticketCreatedV1.schema.parse(received[0])).toEqual(envelopes[0]);
  });

  it('records the failure and keeps the rows when the broker rejects the batch', async () => {
    const failing = new OutboxRelay(db, config, {
      publish: async () => {
        throw new Error('broker down');
      },
    });
    const envelope = created('Will fail', new Date(inOneHour));
    await append([{ id: envelope.id, payload: envelope, occurredAt: new Date(inOneHour) }]);

    expect(await failing.drainBatch(later)).toBe(0);
    expect(await stored(envelope.id)).toEqual({
      published_at: null,
      attempts: 1,
      last_error: 'broker down',
    });

    // The real publisher then succeeds and clears the error.
    expect(await relay.drainBatch(later)).toBe(1);
    const published = await stored(envelope.id);
    expect(published.published_at).not.toBeNull();
    expect(published.last_error).toBeNull();
  });

  it('quarantines an unparsable row and still publishes the valid ones', async () => {
    const poisonId = randomUUID();
    await append([
      { id: poisonId, payload: { not: 'an envelope' }, occurredAt: new Date(inOneHour) },
    ]);
    const valid = created('After poison', new Date(inOneHour));
    await append([{ id: valid.id, payload: valid, occurredAt: new Date(inOneHour) }]);

    expect(await relay.drainBatch(later)).toBe(2);
    const poison = await stored(poisonId);
    expect(poison.published_at).toBeNull();
    expect(poison.attempts).toBe(config.maxAttempts);
    expect(poison.last_error).toContain('unparsable envelope');
    expect((await stored(valid.id)).published_at).not.toBeNull();
    expect(await relay.drainBatch(later)).toBe(0); // quarantined rows are skipped from now on
  });

  it('lets two relays drain concurrently without publishing a row twice', async () => {
    const envelopes = [1, 2, 3, 4].map((n) =>
      created(`Parallel ${n}`, new Date(inOneHour + 10_000 + n)),
    );
    await append(
      envelopes.map((e) => ({ id: e.id, payload: e, occurredAt: new Date(e.occurredAt) })),
    );
    const other = new OutboxRelay(db, { ...config, batchSize: 2 }, publisher);

    const [a, b] = await Promise.all([relay.drainBatch(later), other.drainBatch(later)]);
    expect(a + b).toBe(4); // SKIP LOCKED gave each relay a distinct batch
    for (const e of envelopes) expect((await stored(e.id)).published_at).not.toBeNull();
  });
});
