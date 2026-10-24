import type { EventEnvelope } from '@ticketmanager/events';

export const OUTBOX = Symbol('OUTBOX');

export interface OutboxEvent {
  envelope: EventEnvelope;
  aggregateType: string;
  aggregateId: string;
}

/**
 * Transactional outbox port. `append` must be called inside a `UnitOfWork` so the rows commit
 * with the aggregate; the relay publishes them afterwards.
 */
export interface Outbox {
  append(events: OutboxEvent[]): Promise<void>;
}
