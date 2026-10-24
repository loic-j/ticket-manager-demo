import type { EventEnvelope } from '@ticketmanager/events';

/** Raised by the broker consumer for every message on the tickets queue. */
export class HandleTicketEventCommand {
  constructor(readonly envelope: EventEnvelope) {}
}
