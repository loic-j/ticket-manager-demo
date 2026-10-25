import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { parseEnvelope } from '@ticketmanager/events';
import amqp, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib';
import { HandleTicketEventCommand } from '../../notifications/application/commands/index.js';
import { CONSUMER_CONFIG, type ConsumerConfig } from '../messaging.config.js';

const RECONNECT_DELAY_MS = 5_000;
const MAX_RETRY_BACKOFF_MS = 10_000;

/** The subset of amqplib's Channel the consumer uses (also what the unit test fakes). */
export type ConsumerChannel = Pick<Channel, 'ack' | 'nack'>;

/**
 * Consumes ticket events from a durable quorum queue bound to the events exchange.
 * - A message is acked once `HandleTicketEventCommand` returned (the notification is committed).
 * - A handler failure is nacked with requeue after a small backoff; the broker counts
 *   deliveries (`x-delivery-count`) and dead-letters the message to `<exchange>.dlx` after
 *   `x-delivery-limit` deliveries (queue `<queue>.dead`, kept for inspection/replay).
 * - An unparsable message is dead-lettered immediately.
 * - Handlers may run concurrently (`prefetch`), so there is no ordering guarantee between
 *   notifications; each notification is independent.
 * - Any connection or channel close triggers a reconnect; shutdown drains in-flight handlers.
 */
@Injectable()
export class TicketEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TicketEventsConsumer.name);
  private connection?: ChannelModel;
  private channel?: Channel;
  private consumerTag?: string;
  private readonly inFlight = new Set<Promise<void>>();
  private stopping = false;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(
    @Inject(CONSUMER_CONFIG) private readonly config: ConsumerConfig,
    private readonly commandBus: CommandBus,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.log('Consumer disabled (CONSUMER_ENABLED=false)');
      return;
    }
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    clearTimeout(this.reconnectTimer);
    if (this.channel && this.consumerTag) {
      await this.channel.cancel(this.consumerTag).catch(() => undefined); // stop new deliveries
    }
    await Promise.allSettled(this.inFlight);
    await this.connection?.close().catch(() => undefined);
  }

  private async connect(): Promise<void> {
    let connection: ChannelModel | undefined;
    try {
      connection = await amqp.connect(this.config.rabbitmqUrl);
      const current = connection;
      connection.on('error', (error: unknown) =>
        this.logger.warn(`Connection error: ${String(error)}`),
      );
      connection.on('close', () => this.lost(current));
      const channel = await connection.createChannel();
      channel.on('error', (error: unknown) => this.logger.warn(`Channel error: ${String(error)}`));
      channel.on('close', () => this.lost(current));
      await this.declareTopology(channel);
      await channel.prefetch(this.config.prefetch);
      const { consumerTag } = await channel.consume(this.config.queue, (message) =>
        this.track(this.handle(channel, message)),
      );
      this.connection = connection;
      this.channel = channel;
      this.consumerTag = consumerTag;
      this.logger.log(`Consuming ${this.config.queue} (${this.config.bindingKeys.join(', ')})`);
    } catch (error) {
      this.logger.warn(`Cannot start consuming: ${String(error)}`);
      await connection?.close().catch(() => undefined);
      this.scheduleReconnect();
    }
  }

  private async declareTopology(channel: Channel): Promise<void> {
    const { exchange, deadLetterExchange, queue, bindingKeys, deliveryLimit } = this.config;
    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertExchange(deadLetterExchange, 'topic', { durable: true });
    await channel.assertQueue(`${queue}.dead`, {
      durable: true,
      arguments: { 'x-queue-type': 'quorum' },
    });
    await channel.bindQueue(`${queue}.dead`, deadLetterExchange, '#');
    await channel.assertQueue(queue, {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum',
        'x-dead-letter-exchange': deadLetterExchange,
        'x-dead-letter-strategy': 'at-least-once',
        'x-overflow': 'reject-publish',
        'x-delivery-limit': deliveryLimit,
      },
    });
    for (const key of bindingKeys) {
      await channel.bindQueue(queue, exchange, key);
    }
  }

  private track(work: Promise<void>): void {
    this.inFlight.add(work);
    void work.finally(() => this.inFlight.delete(work));
  }

  /** Public for unit tests; `channel` only needs `ack`/`nack`. */
  async handle(channel: ConsumerChannel, message: ConsumeMessage | null): Promise<void> {
    if (!message) return; // consumer cancelled by the broker
    let envelope;
    try {
      envelope = parseEnvelope(JSON.parse(message.content.toString()));
    } catch (error) {
      this.logger.error(`Dead-lettering unparsable message: ${String(error)}`);
      this.safe(() => channel.nack(message, false, false));
      return;
    }
    try {
      const result = await this.commandBus.execute(new HandleTicketEventCommand(envelope));
      this.logger.debug(`${envelope.type} ${envelope.id}: ${result}`);
      this.safe(() => channel.ack(message));
    } catch (error) {
      const deliveries = Number(message.properties.headers?.['x-delivery-count'] ?? 0) + 1;
      this.logger.warn(
        `${envelope.type} ${envelope.id} failed (delivery ${deliveries}): ${String(error)}`,
      );
      await new Promise((r) => setTimeout(r, Math.min(1000 * deliveries, MAX_RETRY_BACKOFF_MS)));
      this.safe(() => channel.nack(message, false, true));
    }
  }

  /** ack/nack throw on a closed channel; the broker then redelivers the message anyway. */
  private safe(operation: () => void): void {
    try {
      operation();
    } catch (error) {
      this.logger.warn(`Channel operation failed (message will be redelivered): ${String(error)}`);
    }
  }

  private lost(connection: ChannelModel): void {
    if (this.connection !== connection) return; // event from a connection already replaced
    this.connection = undefined;
    this.channel = undefined;
    this.consumerTag = undefined;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.stopping || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect();
    }, RECONNECT_DELAY_MS);
    this.reconnectTimer.unref();
  }
}
