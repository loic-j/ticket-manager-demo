import type { CommandBus } from '@nestjs/cqrs';
import { ticketCreatedV1 } from '@ticketmanager/events';
import type { ConsumeMessage } from 'amqplib';
import { loadConsumerConfig } from './messaging.config.js';
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
  const event = ticketCreatedV1.create({
    ticketId: crypto.randomUUID(),
    title: 'T',
    priority: 'low',
    createdBy: 'u1',
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

  it('requeues (after a backoff) when the command fails', async () => {
    const pending = consumer(async () => {
      throw new Error('db down');
    }).handle(channel, message(event, { 'x-delivery-count': 2 }));
    await vi.advanceTimersByTimeAsync(3000);
    await pending;
    expect(nacks).toEqual([{ requeue: true }]);
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
