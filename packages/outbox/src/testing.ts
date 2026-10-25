import type { EventEnvelope } from '@ticketmanager/events';
import type { EventPublisher } from './event-publisher.js';

/** Test double: records what the relay would have published (no broker). */
export class CapturingEventPublisher implements EventPublisher {
  readonly published: EventEnvelope[] = [];

  async publish(envelopes: EventEnvelope[]): Promise<void> {
    this.published.push(...envelopes);
  }
}
