import type { EventEnvelope } from '@ticketmanager/events';

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

/** Broker port used by the outbox relay only. Resolves once the broker confirmed every message. */
export interface EventPublisher {
  publish(envelopes: EventEnvelope[]): Promise<void>;
}
