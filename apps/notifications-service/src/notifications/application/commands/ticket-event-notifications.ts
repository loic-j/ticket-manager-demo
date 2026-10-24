import { ticketCreatedV1, ticketStatusChangedV1, type EventEnvelope } from '@ticketmanager/events';
import type { NewNotification } from '../../domain/notification.js';

/**
 * Decides which notification an integration event produces, if any. Pure: the handler adds the
 * recipient's email and persistence. Unknown or irrelevant events return `null` (acked, ignored).
 */
export function notificationFor(envelope: EventEnvelope): Omit<NewNotification, 'eventId'> | null {
  if (ticketCreatedV1.is(envelope)) {
    const { ticketId, title, priority, createdBy } = envelope.payload;
    return {
      userId: createdBy,
      kind: 'ticket_created',
      title: `Ticket created: ${title}`,
      body: `Your ticket "${title}" (priority ${priority}) has been created.`,
      ticketId,
    };
  }
  if (ticketStatusChangedV1.is(envelope)) {
    const { ticketId, title, from, to, createdBy } = envelope.payload;
    return {
      userId: createdBy,
      kind: 'ticket_status_changed',
      title: `Ticket ${to.replace('_', ' ')}: ${title}`,
      body: `Your ticket "${title}" moved from ${from} to ${to}.`,
      ticketId,
    };
  }
  return null;
}
