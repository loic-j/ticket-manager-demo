import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';

export const MESSAGING_CONFIG = Symbol('MESSAGING_CONFIG');

const envSchema = z.object({
  RABBITMQ_URL: z.string().min(1).default('amqp://ticketmanager:ticketmanager@localhost:5672'),
  EVENTS_EXCHANGE: z.string().min(1).default('ticketmanager.events'),
  OUTBOX_RELAY_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  OUTBOX_RELAY_INTERVAL_MS: z.coerce.number().int().positive().default(500),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().max(500).default(50),
  /** Rows that failed this many times are left in the table for inspection and skipped. */
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().positive().default(25),
  /** Upper bound for one broker round trip (connect, confirms); must stay below the DB
   * transaction timeout of the relay. */
  BROKER_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export type MessagingConfig = {
  rabbitmqUrl: string;
  exchange: string;
  relayEnabled: boolean;
  relayIntervalMs: number;
  batchSize: number;
  maxAttempts: number;
  brokerTimeoutMs: number;
};

type Env = Partial<Record<keyof z.input<typeof envSchema>, string | undefined>>;

/** Reads the variables through `ConfigService` (which loaded `.env`) or from a plain object. */
export function loadMessagingConfig(source: Pick<ConfigService, 'get'> | Env): MessagingConfig {
  const env: Env =
    'get' in source && typeof source.get === 'function'
      ? Object.fromEntries(
          Object.keys(envSchema.shape).map((key) => [key, source.get<string>(key)]),
        )
      : (source as Env);
  const e = envSchema.parse(env);
  return {
    rabbitmqUrl: e.RABBITMQ_URL,
    exchange: e.EVENTS_EXCHANGE,
    relayEnabled: e.OUTBOX_RELAY_ENABLED,
    relayIntervalMs: e.OUTBOX_RELAY_INTERVAL_MS,
    batchSize: e.OUTBOX_BATCH_SIZE,
    maxAttempts: e.OUTBOX_MAX_ATTEMPTS,
    brokerTimeoutMs: e.BROKER_TIMEOUT_MS,
  };
}
