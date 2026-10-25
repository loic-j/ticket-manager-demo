import { ticketChangedV1, ticketCreatedV1, ticketDeletedV1 } from '@ticketmanager/events';
import {
  TicketChangedEvent,
  TicketCreatedEvent,
  TicketDeletedEvent,
  type TicketDomainEvent,
} from '../../domain/events/ticket-events.js';
import type { OutboxEvent } from '../../../messaging/ports/outbox.js';

const AGGREGATE = 'ticket';

/** Translates domain events into the versioned, state-carrying integration events. */
export function toIntegrationEvents(events: TicketDomainEvent[], actor: string): OutboxEvent[] {
  return events.map((event) => ({
    aggregateType: AGGREGATE,
    aggregateId: event instanceof TicketDeletedEvent ? event.ticketId : event.ticket.id,
    envelope: toEnvelope(event, actor),
  }));
}

function toEnvelope(event: TicketDomainEvent, actor: string) {
  const meta = { actor };
  if (event instanceof TicketCreatedEvent) {
    return ticketCreatedV1.create({ ticket: event.ticket }, meta);
  }
  if (event instanceof TicketChangedEvent) {
    return ticketChangedV1.create({ ticket: event.ticket, changes: event.changes }, meta);
  }
  return ticketDeletedV1.create(
    { ticketId: event.ticketId, version: event.version, deletedBy: event.deletedBy },
    meta,
  );
}
