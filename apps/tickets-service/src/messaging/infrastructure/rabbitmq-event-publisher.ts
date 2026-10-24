import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { EventEnvelope } from '@ticketmanager/events';
import amqp, { type ChannelModel, type ConfirmChannel } from 'amqplib';
import { MESSAGING_CONFIG, type MessagingConfig } from '../messaging.config.js';
import type { EventPublisher } from '../ports/event-publisher.js';

/**
 * Publishes envelopes to a durable topic exchange with publisher confirms. The connection is
 * opened lazily and dropped on any connection or channel error; the next publish reconnects,
 * so a broker outage only delays the outbox relay. Every broker wait is bounded by
 * `brokerTimeoutMs` so a hung broker cannot hold the relay's database transaction open.
 */
@Injectable()
export class RabbitMqEventPublisher implements EventPublisher, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqEventPublisher.name);
  private connecting?: Promise<ConfirmChannel>;
  private connection?: ChannelModel;

  constructor(@Inject(MESSAGING_CONFIG) private readonly config: MessagingConfig) {}

  async publish(envelopes: EventEnvelope[]): Promise<void> {
    if (envelopes.length === 0) return;
    const channel = await this.getChannel();
    for (const envelope of envelopes) {
      channel.publish(this.config.exchange, envelope.type, Buffer.from(JSON.stringify(envelope)), {
        persistent: true,
        contentType: 'application/json',
        messageId: envelope.id,
        type: envelope.type,
        timestamp: Math.floor(Date.parse(envelope.occurredAt) / 1000),
        headers: {
          'x-event-version': envelope.version,
          ...(envelope.correlationId ? { 'x-correlation-id': envelope.correlationId } : {}),
        },
      });
    }
    await this.withTimeout(channel.waitForConfirms(), 'publisher confirms');
  }

  /** One shared connection attempt at a time; concurrent callers await the same promise. */
  private getChannel(): Promise<ConfirmChannel> {
    this.connecting ??= this.open().catch((error: unknown) => {
      this.reset();
      throw error;
    });
    return this.connecting;
  }

  private async open(): Promise<ConfirmChannel> {
    const connection = await this.withTimeout(
      amqp.connect(this.config.rabbitmqUrl, { timeout: this.config.brokerTimeoutMs }),
      'broker connection',
    );
    this.connection = connection;
    connection.on('error', (error: unknown) => {
      this.logger.warn(`RabbitMQ connection error: ${String(error)}`);
    });
    connection.on('close', () => this.reset());
    try {
      const channel = await connection.createConfirmChannel();
      channel.on('error', (error: unknown) => {
        this.logger.warn(`RabbitMQ channel error: ${String(error)}`);
      });
      channel.on('close', () => this.reset());
      await channel.assertExchange(this.config.exchange, 'topic', { durable: true });
      return channel;
    } catch (error) {
      await connection.close().catch(() => undefined);
      throw error;
    }
  }

  private reset(): void {
    this.connecting = undefined;
    this.connection = undefined;
  }

  private withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(new Error(`RabbitMQ ${what} timed out after ${this.config.brokerTimeoutMs}ms`)),
        this.config.brokerTimeoutMs,
      );
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async onModuleDestroy(): Promise<void> {
    const connection = this.connection;
    this.reset();
    await connection?.close().catch(() => undefined);
  }
}
