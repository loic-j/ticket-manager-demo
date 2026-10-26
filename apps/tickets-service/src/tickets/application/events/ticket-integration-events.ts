import { ticketChangedV1, ticketCreatedV1, ticketDeletedV2 } from '@ticketmanager/events';
import {
  TicketChangedEvent,
  TicketCreatedEvent,
  TicketDeletedEvent,
  type TicketDomainEvent,
} from '../../domain/events/ticket-events.js';
import type { ActorId } from '../../domain/ticket.js';
import type { OutboxEvent } from '../../../messaging/application/ports/outbox.js';
import { toTicketView } from '../mappers/ticket.mapper.js';

const AGGREGATE = 'ticket';

/** Translates domain events into the versioned, state-carrying integration events. */
export function toIntegrationEvents(events: TicketDomainEvent[], actor: ActorId): OutboxEvent[] {
  return events.map((event) => ({
    aggregateType: AGGREGATE,
    aggregateId: event.ticket.id,
    envelope: toEnvelope(event, actor),
  }));
}

function toEnvelope(event: TicketDomainEvent, actor: ActorId) {
  const meta = { actor };
  if (event instanceof TicketCreatedEvent) {
    return ticketCreatedV1.create({ ticket: toTicketView(event.ticket) }, meta);
  }
  if (event instanceof TicketChangedEvent) {
    return ticketChangedV1.create(
      { ticket: toTicketView(event.ticket), changes: event.changes },
      meta,
    );
  }
  return ticketDeletedV2.create(
    { ticket: toTicketView(event.ticket), version: event.version, deletedBy: event.deletedBy },
    meta,
  );
}
