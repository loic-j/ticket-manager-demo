import type { EventEnvelope } from '@ticketmanager/events';
import type { EventPublisher } from '../ports/event-publisher.js';
import type { Outbox, OutboxEvent } from '../ports/outbox.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';

/** Test doubles for the messaging ports (no database, no broker). */

export class ImmediateUnitOfWork implements UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}

export class InMemoryOutbox implements Outbox {
  readonly events: OutboxEvent[] = [];

  async append(events: OutboxEvent[]): Promise<void> {
    this.events.push(...events);
  }
}

export class CapturingEventPublisher implements EventPublisher {
  readonly published: EventEnvelope[] = [];

  async publish(envelopes: EventEnvelope[]): Promise<void> {
    this.published.push(...envelopes);
  }
}
