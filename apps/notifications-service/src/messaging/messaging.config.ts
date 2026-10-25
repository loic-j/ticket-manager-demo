import { readEnv, type EnvSource } from '@ticketmanager/nest-common';
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

export function loadConsumerConfig(source: EnvSource): ConsumerConfig {
  const e = readEnv(envSchema, source);
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
