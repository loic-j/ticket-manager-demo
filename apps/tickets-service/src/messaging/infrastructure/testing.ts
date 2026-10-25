import type { Outbox, OutboxEvent } from '../application/ports/outbox.js';
import type { UnitOfWork } from '../application/ports/unit-of-work.js';

/** Test doubles for the messaging ports (no database). */

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
