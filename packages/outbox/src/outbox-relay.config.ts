import { z } from 'zod';

export const OUTBOX_RELAY_CONFIG = Symbol('OUTBOX_RELAY_CONFIG');

const envSchema = z.object({
  /** Database holding the `outbox_messages` table (the producing service's database). */
  DATABASE_URL: z.string().min(1),
  RABBITMQ_URL: z.string().min(1).default('amqp://ticketmanager:ticketmanager@localhost:5672'),
  EVENTS_EXCHANGE: z.string().min(1).default('ticketmanager.events'),
  OUTBOX_RELAY_INTERVAL_MS: z.coerce.number().int().positive().default(500),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().max(500).default(50),
  /** `attempts` value of a quarantined (unparsable) row; rows at or above it are skipped. */
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().positive().default(25),
  /** Upper bound for one broker wait (connect, channel, exchange, confirms). Keep it below the
   * relay's `idle_in_transaction_session_timeout` (30 s), which releases the row locks if the
   * broker hangs anyway. */
  BROKER_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export type OutboxRelayConfig = {
  databaseUrl: string;
  rabbitmqUrl: string;
  exchange: string;
  relayIntervalMs: number;
  batchSize: number;
  maxAttempts: number;
  brokerTimeoutMs: number;
};

type Env = Partial<Record<keyof z.input<typeof envSchema>, string | undefined>>;
/** Anything with a `get(key)` such as NestJS `ConfigService`, or a plain env object. */
type ConfigSource = { get<T = string>(key: string): T | undefined } | Env;

/** Reads the variables through a `ConfigService`-like source (which loaded `.env`) or a plain object. */
export function loadOutboxRelayConfig(source: ConfigSource): OutboxRelayConfig {
  const env: Env =
    'get' in source && typeof source.get === 'function'
      ? Object.fromEntries(
          Object.keys(envSchema.shape).map((key) => [key, source.get<string>(key)]),
        )
      : (source as Env);
  const e = envSchema.parse(env);
  return {
    databaseUrl: e.DATABASE_URL,
    rabbitmqUrl: e.RABBITMQ_URL,
    exchange: e.EVENTS_EXCHANGE,
    relayIntervalMs: e.OUTBOX_RELAY_INTERVAL_MS,
    batchSize: e.OUTBOX_BATCH_SIZE,
    maxAttempts: e.OUTBOX_MAX_ATTEMPTS,
    brokerTimeoutMs: e.BROKER_TIMEOUT_MS,
  };
}
