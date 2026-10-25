import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { ticketCreatedV1, type EventEnvelope } from '@ticketmanager/events';
import amqp from 'amqplib';
import { PrismaService } from '../src/database/prisma.service.js';
import { OutboxRelay } from '../src/messaging/infrastructure/outbox-relay.js';
import { PrismaOutbox } from '../src/messaging/infrastructure/prisma-outbox.js';
import { PrismaUnitOfWork } from '../src/messaging/infrastructure/prisma-unit-of-work.js';
import { RabbitMqEventPublisher } from '../src/messaging/infrastructure/rabbitmq-event-publisher.js';
import { loadMessagingConfig } from '../src/messaging/messaging.config.js';
import { createTicket } from '../src/tickets/domain/ticket.js';

/** Needs tickets-db and rabbitmq (`pnpm infra:up`). Uses a throwaway queue bound to `ticket.#`. */
describe('OutboxRelay (integration)', () => {
  const config = loadMessagingConfig(process.env);
  let prisma: PrismaService;
  let publisher: RabbitMqEventPublisher;
  let relay: OutboxRelay;
  let connection: amqp.ChannelModel;
  let queue: string;
  const ids: string[] = [];
  // Rows are dated in the future so a relay running elsewhere (e.g. `pnpm dev` against the
  // same database) ignores them; this test's relay drains with a later `now`.
  const inOneHour = Date.now() + 60 * 60 * 1000;
  const later = new Date(inOneHour + 60 * 60 * 1000);

  const created = (title: string, occurredAt: Date) =>
    ticketCreatedV1.create(
      { ticket: createTicket({ title, description: '', priority: 'low' }, 'user_int').ticket },
      { occurredAt: occurredAt.toISOString() },
    );
  const row = (envelope: ReturnType<typeof created>) => ({
    envelope,
    aggregateType: 'ticket',
    aggregateId: envelope.payload.ticket.id,
  });

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService());
    publisher = new RabbitMqEventPublisher(config);
    relay = new OutboxRelay(prisma, { ...config, batchSize: 2 }, publisher);

    connection = await amqp.connect(config.rabbitmqUrl);
    const channel = await connection.createChannel();
    await channel.assertExchange(config.exchange, 'topic', { durable: true });
    ({ queue } = await channel.assertQueue('', { exclusive: true }));
    await channel.bindQueue(queue, config.exchange, 'ticket.#');
    await channel.close();
  });

  afterAll(async () => {
    await prisma.db.outboxMessage.deleteMany({ where: { id: { in: ids } } });
    await publisher.onModuleDestroy();
    await connection.close();
    await prisma.onModuleDestroy();
  });

  it('publishes outbox rows in order, marks them, and republishes nothing afterwards', async () => {
    const envelopes = [1, 2, 3].map((n) => created(`Outbox ${n}`, new Date(inOneHour + n * 1000)));
    ids.push(...envelopes.map((e) => e.id));
    await new PrismaUnitOfWork(prisma).run(() =>
      new PrismaOutbox(prisma).append(envelopes.map(row)),
    );

    // batchSize = 2: first drain publishes 2, second publishes 1, third finds nothing.
    expect(await relay.drainBatch(later)).toBe(2);
    expect(await relay.drainBatch(later)).toBe(1);
    expect(await relay.drainBatch(later)).toBe(0);

    const rows = await prisma.db.outboxMessage.findMany({ where: { id: { in: ids } } });
    expect(rows.every((r) => r.publishedAt !== null && r.attempts === 0)).toBe(true);

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
    const failing = new OutboxRelay(prisma, config, {
      publish: async () => {
        throw new Error('broker down');
      },
    });
    const envelope = created('Will fail', new Date(inOneHour));
    ids.push(envelope.id);
    await new PrismaOutbox(prisma).append([row(envelope)]);

    expect(await failing.drainBatch(later)).toBe(0);
    const stored = await prisma.db.outboxMessage.findUniqueOrThrow({ where: { id: envelope.id } });
    expect(stored.publishedAt).toBeNull();
    expect(stored.attempts).toBe(1);
    expect(stored.lastError).toBe('broker down');

    // The real publisher then succeeds and clears the error.
    expect(await relay.drainBatch(later)).toBe(1);
    const published = await prisma.db.outboxMessage.findUniqueOrThrow({
      where: { id: envelope.id },
    });
    expect(published.publishedAt).not.toBeNull();
    expect(published.lastError).toBeNull();
  });

  it('quarantines an unparsable row and still publishes the valid ones', async () => {
    const poisonId = crypto.randomUUID();
    ids.push(poisonId);
    await prisma.db.outboxMessage.create({
      data: {
        id: poisonId,
        type: 'ticket.created',
        version: 1,
        aggregateType: 'ticket',
        aggregateId: crypto.randomUUID(),
        payload: { not: 'an envelope' },
        occurredAt: new Date(inOneHour),
      },
    });
    const valid = created('After poison', new Date(inOneHour));
    ids.push(valid.id);
    await new PrismaOutbox(prisma).append([row(valid)]);

    expect(await relay.drainBatch(later)).toBe(2);
    const poison = await prisma.db.outboxMessage.findUniqueOrThrow({ where: { id: poisonId } });
    expect(poison.publishedAt).toBeNull();
    expect(poison.attempts).toBe(config.maxAttempts);
    expect(poison.lastError).toContain('unparsable envelope');
    expect(
      (await prisma.db.outboxMessage.findUniqueOrThrow({ where: { id: valid.id } })).publishedAt,
    ).not.toBeNull();
    expect(await relay.drainBatch(later)).toBe(0); // quarantined rows are skipped from now on
  });

  it('lets two relays drain concurrently without publishing a row twice', async () => {
    const envelopes = [1, 2, 3, 4].map((n) =>
      created(`Parallel ${n}`, new Date(inOneHour + 10_000 + n)),
    );
    ids.push(...envelopes.map((e) => e.id));
    await new PrismaOutbox(prisma).append(envelopes.map(row));
    const other = new OutboxRelay(prisma, { ...config, batchSize: 2 }, publisher);

    const [a, b] = await Promise.all([relay.drainBatch(later), other.drainBatch(later)]);
    expect(a + b).toBe(4); // SKIP LOCKED gave each relay a distinct batch
    const rows = await prisma.db.outboxMessage.findMany({
      where: { id: { in: envelopes.map((e) => e.id) } },
    });
    expect(rows.every((r) => r.publishedAt !== null)).toBe(true);
  });

  it('rolls back the outbox rows when the unit of work fails, and joins nested units', async () => {
    const uow = new PrismaUnitOfWork(prisma);
    const outbox = new PrismaOutbox(prisma);
    const envelope = created('Rolled back', new Date(inOneHour));
    await expect(
      uow.run(async () => {
        await uow.run(() => outbox.append([row(envelope)]));
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await prisma.db.outboxMessage.findUnique({ where: { id: envelope.id } })).toBeNull();
  });
});
