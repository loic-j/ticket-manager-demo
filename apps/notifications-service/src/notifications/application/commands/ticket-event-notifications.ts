import { notificationSchema } from '@ticketmanager/contracts';
import {
  ticketChangedV1,
  ticketCreatedV1,
  ticketDeletedV1,
  ticketDeletedV2,
  type EventDefinition,
  type EventEnvelope,
  type TicketChanges,
} from '@ticketmanager/events';
import type { NewNotification } from '../../domain/notification.js';

/** Same bound as the `title` column (`VarChar(200)`) and the API view. */
export const NOTIFICATION_TITLE_MAX_LENGTH = notificationSchema.shape.title.maxLength ?? 200;

/** A notification to store, before the handler attaches the event id. */
export type NotificationDraft = Omit<NewNotification, 'eventId'>;

/**
 * What an integration event means for this service:
 * - `unknown`: a type or version this service does not know, or a payload that does not match
 *   its schema; nothing to record (acked, ignored).
 * - `ticket`: a ticket event. The handler always claims it and advances the ticket version,
 *   even when `draft` is `null` (an event version that carries no state to describe), so a later
 *   message carrying a lower version is recognised as stale whatever the delivery order.
 */
export type TicketEventOutcome =
  | { kind: 'unknown'; reason: 'unknown-type' | 'invalid-payload' }
  | { kind: 'ticket'; ticketId: string; version: number; draft: NotificationDraft | null };

/**
 * Decides which notification an integration event produces. The ticket creator is told about
 * every creation, edit (status changes have their own wording) and deletion of their ticket.
 * Pure: the handler adds the recipient's email and persistence. Payloads are validated against
 * the event schemas, never trusted on type and version alone.
 */
export function notificationFor(envelope: EventEnvelope): TicketEventOutcome {
  const created = match(ticketCreatedV1, envelope);
  if (created) {
    if (created === 'invalid') return INVALID;
    const { id, title, priority, createdBy, version } = created.payload.ticket;
    return {
      kind: 'ticket',
      ticketId: id,
      version,
      draft: {
        userId: createdBy,
        kind: 'ticket_created',
        title: truncate(`Ticket created: ${title}`),
        body: `Your ticket "${title}" (priority ${priority}) has been created.`,
        ticketId: id,
      },
    };
  }
  const changed = match(ticketChangedV1, envelope);
  if (changed) {
    if (changed === 'invalid') return INVALID;
    const { ticket, changes } = changed.payload;
    const status = changes.status;
    return {
      kind: 'ticket',
      ticketId: ticket.id,
      version: ticket.version,
      draft: status
        ? {
            userId: ticket.createdBy,
            kind: 'ticket_status_changed',
            title: truncate(`Ticket ${status.to.replace('_', ' ')}: ${ticket.title}`),
            body: `Your ticket "${ticket.title}" moved from ${status.from} to ${status.to}.`,
            ticketId: ticket.id,
          }
        : {
            userId: ticket.createdBy,
            kind: 'ticket_updated',
            title: truncate(`Ticket updated: ${ticket.title}`),
            body: `Your ticket "${ticket.title}" has been updated: ${describeChanges(changes)}.`,
            ticketId: ticket.id,
          },
    };
  }
  const deleted = match(ticketDeletedV2, envelope);
  if (deleted) {
    if (deleted === 'invalid') return INVALID;
    const { ticket, version } = deleted.payload;
    return {
      kind: 'ticket',
      ticketId: ticket.id,
      version,
      draft: {
        userId: ticket.createdBy,
        kind: 'ticket_deleted',
        title: truncate(`Ticket deleted: ${ticket.title}`),
        body: `Your ticket "${ticket.title}" has been deleted.`,
        ticketId: ticket.id,
      },
    };
  }
  // v1 deletions carry no state to describe: advance the version, notify nobody.
  const deletedV1 = match(ticketDeletedV1, envelope);
  if (deletedV1) {
    if (deletedV1 === 'invalid') return INVALID;
    const { ticketId, version } = deletedV1.payload;
    return { kind: 'ticket', ticketId, version, draft: null };
  }
  return { kind: 'unknown', reason: 'unknown-type' };
}

const INVALID = { kind: 'unknown', reason: 'invalid-payload' } as const;

/** `null` when the envelope is another event, `'invalid'` when it is this event with a bad payload. */
function match<P>(
  definition: EventDefinition<string, number, P>,
  envelope: EventEnvelope,
): EventEnvelope<P> | 'invalid' | null {
  if (!definition.is(envelope)) return null;
  const parsed = definition.schema.safeParse(envelope);
  return parsed.success ? parsed.data : 'invalid';
}

const CHANGE_ORDER = ['title', 'status', 'priority', 'description'] as const;

/** `title "A" → "B", priority low → high`, in a fixed field order; long text is summarised. */
export function describeChanges(changes: TicketChanges): string {
  return CHANGE_ORDER.flatMap((field) => {
    const change = changes[field];
    if (!change) return [];
    if (field === 'description') return ['description edited'];
    return [`${field} ${quote(change.from)} → ${quote(change.to)}`];
  }).join(', ');
}

const quote = (value: string) => (value.includes(' ') ? `"${value}"` : value);

/** Keeps a computed title within the column bound, ending with an ellipsis when cut. */
export function truncate(title: string, maxLength = NOTIFICATION_TITLE_MAX_LENGTH): string {
  return title.length <= maxLength ? title : `${title.slice(0, maxLength - 1)}…`;
}
