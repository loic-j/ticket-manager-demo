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
    const { ticket, changes } = envelope.payload;
    const status = changes.status;
    if (!status) return null; // title, description or priority edits do not notify
    return {
      userId: ticket.createdBy,
      kind: 'ticket_status_changed',
      title: `Ticket ${status.to.replace('_', ' ')}: ${ticket.title}`,
      body: `Your ticket "${ticket.title}" moved from ${status.from} to ${status.to}.`,
      ticketId: ticket.id,
    };
  }
  return null;
}
