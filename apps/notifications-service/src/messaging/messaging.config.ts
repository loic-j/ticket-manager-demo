import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';

export const CONSUMER_CONFIG = Symbol('CONSUMER_CONFIG');

const envSchema = z.object({
  RABBITMQ_URL: z.string().min(1).default('amqp://ticketmanager:ticketmanager@localhost:5672'),
  EVENTS_EXCHANGE: z.string().min(1).default('ticketmanager.events'),
  CONSUMER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  CONSUMER_PREFETCH: z.coerce.number().int().positive().default(10),
  /** Deliveries (first + redeliveries) before the broker dead-letters a message. */
  CONSUMER_DELIVERY_LIMIT: z.coerce.number().int().positive().default(5),
});

export interface ConsumerConfig {
  rabbitmqUrl: string;
  exchange: string;
  enabled: boolean;
  prefetch: number;
  deliveryLimit: number;
  queue: string;
  deadLetterExchange: string;
  bindingKeys: string[];
}

type Env = Partial<Record<keyof z.input<typeof envSchema>, string | undefined>>;

export function loadConsumerConfig(source: Pick<ConfigService, 'get'> | Env): ConsumerConfig {
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
    enabled: e.CONSUMER_ENABLED,
    prefetch: e.CONSUMER_PREFETCH,
    deliveryLimit: e.CONSUMER_DELIVERY_LIMIT,
    queue: 'notifications.tickets',
    deadLetterExchange: `${e.EVENTS_EXCHANGE}.dlx`,
    bindingKeys: ['ticket.#'],
  };
}
