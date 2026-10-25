import { ticketSchema } from '@ticketmanager/contracts';
import { z } from 'zod';
import { defineEvent } from '../envelope.js';

/**
 * Ticket events carry the full state after the transition plus its `version`, so consumers
 * never depend on delivery order: apply an event only when `version` is greater than the last
 * one seen for that ticket, otherwise acknowledge and ignore it.
 */
export const ticketCreatedV1 = defineEvent('ticket.created', 1, z.object({ ticket: ticketSchema }));

export const ticketChangedV1 = defineEvent(
  'ticket.changed',
  1,
  z.object({
    ticket: ticketSchema,
    /** Fields that differ from the previous version, e.g. `['status', 'title']`. */
    changedFields: z.array(z.string().min(1)).min(1),
    previousStatus: ticketSchema.shape.status,
  }),
);

export const ticketDeletedV1 = defineEvent(
  'ticket.deleted',
  1,
  z.object({
    ticketId: z.uuid(),
    /** Version of the ticket when it was deleted; a deletion supersedes every lower version. */
    version: z.number().int().positive(),
    deletedBy: z.string().min(1),
  }),
);

/** Every ticket event, for consumers that bind `ticket.#`. */
export const TICKET_EVENTS = [ticketCreatedV1, ticketChangedV1, ticketDeletedV1] as const;

/** Version carried by any ticket event, for consumer-side staleness checks. */
export function ticketEventVersion(
  payload: { ticket: { version: number } } | { version: number },
): number {
  return 'ticket' in payload ? payload.ticket.version : payload.version;
}
