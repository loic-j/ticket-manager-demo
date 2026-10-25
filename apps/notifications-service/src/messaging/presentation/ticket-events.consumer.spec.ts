import type { CommandBus } from '@nestjs/cqrs';
import { ticketCreatedV1 } from '@ticketmanager/events';
import type { ConsumeMessage } from 'amqplib';
import { loadConsumerConfig } from '../messaging.config.js';
import { TicketEventsConsumer } from './ticket-events.consumer.js';

function message(body: unknown, headers: Record<string, unknown> = {}): ConsumeMessage {
  return {
    content: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)),
    fields: {
      deliveryTag: 1,
      redelivered: false,
      exchange: 'x',
      routingKey: 'k',
      consumerTag: 'c',
    },
    properties: { headers } as ConsumeMessage['properties'],
  };
}

describe('TicketEventsConsumer.handle', () => {
  const now = new Date().toISOString();
  const event = ticketCreatedV1.create({
    ticket: {
      id: crypto.randomUUID(),
      title: 'T',
      description: '',
      status: 'open',
      priority: 'low',
      createdBy: 'u1',
      updatedBy: 'u1',
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  });
  let acks: number;
  let nacks: { requeue: boolean }[];
  const channel = {
    ack: () => {
      acks++;
    },
    nack: (_m: unknown, _all: boolean, requeue: boolean) => {
      nacks.push({ requeue });
    },
  };
  const consumer = (execute: CommandBus['execute']) =>
    new TicketEventsConsumer(loadConsumerConfig({}), { execute } as unknown as CommandBus);

  beforeEach(() => {
    acks = 0;
    nacks = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('acks after the command succeeded', async () => {
    await consumer(async () => 'created').handle(channel, message(event));
    expect(acks).toBe(1);
    expect(nacks).toEqual([]);
  });

  it('requeues after an exponential backoff when the command fails', async () => {
    const failing = consumer(async () => {
      throw new Error('db down');
    });
    // Third delivery (two redeliveries already counted by the broker): 1 s * 2^2 = 4 s.
    const pending = failing.handle(channel, message(event, { 'x-delivery-count': 2 }));
    await vi.advanceTimersByTimeAsync(3999);
    expect(nacks).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(nacks).toEqual([{ requeue: true }]);

    // The backoff is capped at 30 s however many deliveries happened.
    const capped = failing.handle(channel, message(event, { 'x-delivery-count': 40 }));
    await vi.advanceTimersByTimeAsync(30_000);
    await capped;
    expect(nacks).toEqual([{ requeue: true }, { requeue: true }]);
  });

  it('dead-letters an unparsable message immediately', async () => {
    const execute = vi.fn();
    await consumer(execute).handle(channel, message('not json'));
    await consumer(execute).handle(channel, message({ nope: true }));
    expect(nacks).toEqual([{ requeue: false }, { requeue: false }]);
    expect(execute).not.toHaveBeenCalled();
  });

  it('survives a closed channel on ack/nack', async () => {
    const closed = {
      ack: () => {
        throw new Error('Channel closed');
      },
      nack: () => {
        throw new Error('Channel closed');
      },
    };
    await expect(
      consumer(async () => 'created').handle(closed, message(event)),
    ).resolves.toBeUndefined();
    await expect(consumer(async () => 'x').handle(closed, message('bad'))).resolves.toBeUndefined();
  });
});
