import {
  ticketCreatedV1,
  ticketDeletedV1,
  ticketStatusChangedV1,
  ticketUpdatedV1,
} from '@ticketmanager/events';
import {
  TicketCreatedEvent,
  TicketDeletedEvent,
  TicketStatusChangedEvent,
  TicketUpdatedEvent,
  type TicketDomainEvent,
} from '../../domain/events/ticket-events.js';
import type { OutboxEvent } from '../../../messaging/ports/outbox.js';

const AGGREGATE = 'ticket';

/** Translates domain events into the versioned integration events other services consume. */
export function toIntegrationEvents(events: TicketDomainEvent[], actor: string): OutboxEvent[] {
  return events.map((event) => ({
    aggregateType: AGGREGATE,
    aggregateId: aggregateIdOf(event),
    envelope: toEnvelope(event, actor),
  }));
}

function aggregateIdOf(event: TicketDomainEvent): string {
  return event instanceof TicketDeletedEvent ? event.ticketId : event.ticket.id;
}

function toEnvelope(event: TicketDomainEvent, actor: string) {
  const meta = { actor };
  if (event instanceof TicketCreatedEvent) {
    const { id, title, priority, createdBy } = event.ticket;
    return ticketCreatedV1.create({ ticketId: id, title, priority, createdBy }, meta);
  }
  if (event instanceof TicketStatusChangedEvent) {
    const { id, title, createdBy } = event.ticket;
    return ticketStatusChangedV1.create(
      { ticketId: id, title, from: event.from, to: event.to, changedBy: actor, createdBy },
      meta,
    );
  }
  if (event instanceof TicketUpdatedEvent) {
    return ticketUpdatedV1.create(
      { ticketId: event.ticket.id, changedFields: [...event.changedFields], updatedBy: actor },
      meta,
    );
  }
  return ticketDeletedV1.create({ ticketId: event.ticketId, deletedBy: event.deletedBy }, meta);
}
