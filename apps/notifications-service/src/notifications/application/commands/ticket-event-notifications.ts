import { ticketChangedV1, ticketCreatedV1, type EventEnvelope } from '@ticketmanager/events';
import type { NewNotification } from '../../domain/notification.js';

/**
 * Decides which notification an integration event produces, if any. Pure: the handler adds the
 * recipient's email and persistence. Unknown or irrelevant events return `null` (acked, ignored).
 */
export function notificationFor(envelope: EventEnvelope): Omit<NewNotification, 'eventId'> | null {
  if (ticketCreatedV1.is(envelope)) {
    const { id, title, priority, createdBy } = envelope.payload.ticket;
    return {
      userId: createdBy,
      kind: 'ticket_created',
      title: `Ticket created: ${title}`,
      body: `Your ticket "${title}" (priority ${priority}) has been created.`,
      ticketId: id,
    };
  }
  if (ticketChangedV1.is(envelope)) {
    const { ticket, previousStatus } = envelope.payload;
    if (ticket.status === previousStatus) return null; // title/priority edits do not notify
    return {
      userId: ticket.createdBy,
      kind: 'ticket_status_changed',
      title: `Ticket ${ticket.status.replace('_', ' ')}: ${ticket.title}`,
      body: `Your ticket "${ticket.title}" moved from ${previousStatus} to ${ticket.status}.`,
      ticketId: ticket.id,
    };
  }
  return null;
}
