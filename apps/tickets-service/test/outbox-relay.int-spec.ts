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

  /** Retries while another relay instance (e.g. `pnpm dev`) briefly holds the advisory lock. */
  async function drain(r: OutboxRelay, expected: number): Promise<number> {
    let result = 0;
    for (let i = 0; i < 20; i++) {
      result = await r.drainBatch(later);
      if (result === expected || expected === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return result;
  }

  afterAll(async () => {
    await prisma.db.outboxMessage.deleteMany({ where: { id: { in: ids } } });
    await publisher.onModuleDestroy();
    await connection.close();
    await prisma.onModuleDestroy();
  });

  it('publishes outbox rows in order, marks them, and republishes nothing afterwards', async () => {
    const outbox = new PrismaOutbox(prisma);
    const uow = new PrismaUnitOfWork(prisma);
    const envelopes = [1, 2, 3].map((n) =>
      ticketCreatedV1.create(
        {
          ticketId: crypto.randomUUID(),
          title: `Outbox ${n}`,
          priority: 'low',
          createdBy: 'user_int',
        },
        { occurredAt: new Date(inOneHour + n * 1000).toISOString() },
      ),
    );
    ids.push(...envelopes.map((e) => e.id));
    await uow.run(() =>
      outbox.append(
        envelopes.map((envelope) => ({
          envelope,
          aggregateType: 'ticket',
          aggregateId: envelope.payload.ticketId,
        })),
      ),
    );

    // batchSize = 2: first drain publishes 2, second publishes 1, third finds nothing.
    expect(await drain(relay, 2)).toBe(2);
    expect(await drain(relay, 1)).toBe(1);
    expect(await drain(relay, 0)).toBe(0);

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
    const envelope = ticketCreatedV1.create(
      { ticketId: crypto.randomUUID(), title: 'Will fail', priority: 'low', createdBy: 'user_int' },
      { occurredAt: new Date(inOneHour).toISOString() },
    );
    ids.push(envelope.id);
    await new PrismaOutbox(prisma).append([
      { envelope, aggregateType: 'ticket', aggregateId: envelope.payload.ticketId },
    ]);

    expect(await drain(failing, 0)).toBe(0);
    const row = await prisma.db.outboxMessage.findUniqueOrThrow({ where: { id: envelope.id } });
    expect(row.publishedAt).toBeNull();
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBe('broker down');

    // The real publisher then succeeds and clears the error.
    expect(await drain(relay, 1)).toBe(1);
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
    const valid = ticketCreatedV1.create(
      {
        ticketId: crypto.randomUUID(),
        title: 'After poison',
        priority: 'low',
        createdBy: 'user_int',
      },
      { occurredAt: new Date(inOneHour).toISOString() },
    );
    ids.push(valid.id);
    await new PrismaOutbox(prisma).append([
      { envelope: valid, aggregateType: 'ticket', aggregateId: valid.payload.ticketId },
    ]);

    expect(await drain(relay, 2)).toBe(2);
    const poison = await prisma.db.outboxMessage.findUniqueOrThrow({ where: { id: poisonId } });
    expect(poison.publishedAt).toBeNull();
    expect(poison.attempts).toBe(config.maxAttempts);
    expect(poison.lastError).toContain('unparsable envelope');
    const ok = await prisma.db.outboxMessage.findUniqueOrThrow({ where: { id: valid.id } });
    expect(ok.publishedAt).not.toBeNull();
    // Quarantined rows are skipped from now on.
    expect(await drain(relay, 0)).toBe(0);
  });

  it('rolls back the outbox rows when the unit of work fails, and joins nested units', async () => {
    const uow = new PrismaUnitOfWork(prisma);
    const outbox = new PrismaOutbox(prisma);
    const envelope = ticketCreatedV1.create(
      {
        ticketId: crypto.randomUUID(),
        title: 'Rolled back',
        priority: 'low',
        createdBy: 'user_int',
      },
      { occurredAt: new Date(inOneHour).toISOString() },
    );
    await expect(
      uow.run(async () => {
        await uow.run(() =>
          outbox.append([
            { envelope, aggregateType: 'ticket', aggregateId: envelope.payload.ticketId },
          ]),
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await prisma.db.outboxMessage.findUnique({ where: { id: envelope.id } })).toBeNull();
  });
});
