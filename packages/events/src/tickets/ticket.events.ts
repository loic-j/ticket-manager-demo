import { ticketSchema, updateTicketSchema } from '@ticketmanager/contracts';
import { z } from 'zod';
import { defineEvent } from '../envelope.js';

/**
 * Ticket events carry the full state after the transition plus its `version`, so consumers
 * never depend on delivery order: apply an event only when `version` is greater than the last
 * one seen for that ticket, otherwise acknowledge and ignore it.
 */
export const ticketCreatedV1 = defineEvent('ticket.created', 1, z.object({ ticket: ticketSchema }));

const fieldChange = <T extends z.ZodType>(value: T) => z.object({ from: value, to: value });

/**
 * Old and new value of every editable field that differs from the previous version, keyed by
 * field name. Derived from the PATCH contract so a new editable field becomes a trackable change.
 */
export const ticketChangesSchema = z
  .object({
    title: fieldChange(updateTicketSchema.shape.title.unwrap()),
    description: fieldChange(updateTicketSchema.shape.description.unwrap()),
    status: fieldChange(updateTicketSchema.shape.status.unwrap()),
    priority: fieldChange(updateTicketSchema.shape.priority.unwrap()),
  })
  .partial()
  .refine((changes) => Object.values(changes).some((change) => change !== undefined), {
    message: 'at least one field must have changed',
  });
export type TicketChanges = z.infer<typeof ticketChangesSchema>;

export const ticketChangedV1 = defineEvent(
  'ticket.changed',
  1,
  z.object({ ticket: ticketSchema, changes: ticketChangesSchema }),
);

export const ticketDeletedV1 = defineEvent(
  'ticket.deleted',
  1,
  z.object({
    ticketId: z.uuid(),
    /**
     * Version *after* the deletion: the last stored version + 1, so the event supersedes every
     * `ticket.created` / `ticket.changed` of that ticket in the consumer's staleness check.
     */
    version: z.number().int().positive(),
    deletedBy: z.string().min(1),
  }),
);

/** Version carried by any ticket event, for consumer-side staleness checks. */
export function ticketEventVersion(
  payload: { ticket: { version: number } } | { version: number },
): number {
  return 'ticket' in payload ? payload.ticket.version : payload.version;
}
