import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { EventEnvelope } from '@ticketmanager/events';
import amqp, { type ChannelModel, type ConfirmChannel } from 'amqplib';
import type { EventPublisher } from './event-publisher.js';
import { OUTBOX_RELAY_CONFIG, type OutboxRelayConfig } from './outbox-relay.config.js';

type PublisherConfig = Pick<OutboxRelayConfig, 'rabbitmqUrl' | 'exchange' | 'brokerTimeoutMs'>;

/**
 * Publishes envelopes to a durable topic exchange with publisher confirms. The connection is
 * opened lazily and dropped on any connection or channel error; the next publish reconnects,
 * so a broker outage only delays the outbox relay. Every broker wait (connect, channel,
 * exchange, confirms) is bounded by `brokerTimeoutMs`; the relay's own
 * `idle_in_transaction_session_timeout` is the last resort if the broker hangs anyway.
 */
@Injectable()
export class RabbitMqEventPublisher implements EventPublisher, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqEventPublisher.name);
  private connecting?: Promise<ConfirmChannel>;
  private connection?: ChannelModel;

  constructor(@Inject(OUTBOX_RELAY_CONFIG) private readonly config: PublisherConfig) {}

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
      // A connection that completes after the race was lost would leak: close it.
      (late) => void late.close().catch(() => undefined),
    );
    this.connection = connection;
    connection.on('error', (error: unknown) => {
      this.logger.warn(`RabbitMQ connection error: ${String(error)}`);
    });
    connection.on('close', () => this.reset());
    try {
      const channel = await this.withTimeout(connection.createConfirmChannel(), 'channel');
      channel.on('error', (error: unknown) => {
        this.logger.warn(`RabbitMQ channel error: ${String(error)}`);
      });
      channel.on('close', () => this.reset());
      await this.withTimeout(
        channel.assertExchange(this.config.exchange, 'topic', { durable: true }),
        'exchange declaration',
      );
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

  /**
   * Rejects after `brokerTimeoutMs` if `promise` has not settled. `onLate` receives the value if
   * the promise still resolves after the timeout (to release what it holds).
   */
  private withTimeout<T>(
    promise: Promise<T>,
    what: string,
    onLate?: (value: T) => void,
  ): Promise<T> {
    let timer: NodeJS.Timeout;
    let timedOut = false;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new Error(`RabbitMQ ${what} timed out after ${this.config.brokerTimeoutMs}ms`));
      }, this.config.brokerTimeoutMs);
    });
    if (onLate) {
      void promise.then(
        (value) => {
          if (timedOut) onLate(value);
        },
        () => undefined,
      );
    }
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async onModuleDestroy(): Promise<void> {
    const connection = this.connection;
    this.reset();
    await connection?.close().catch(() => undefined);
  }
}
