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

/**
 * Version *after* a deletion: the last stored version + 1, so the event supersedes every
 * `ticket.created` / `ticket.changed` of that ticket in the consumer's staleness check.
 */
const supersedingVersion = z.number().int().positive();

/** @deprecated Superseded by {@link ticketDeletedV2}, which carries the deleted ticket's state. */
export const ticketDeletedV1 = defineEvent(
  'ticket.deleted',
  1,
  z.object({ ticketId: z.uuid(), version: supersedingVersion, deletedBy: z.string().min(1) }),
);

/** Deletion with the full state the ticket had when it was deleted (`ticket.version` = last stored). */
export const ticketDeletedV2 = defineEvent(
  'ticket.deleted',
  2,
  z.object({ ticket: ticketSchema, version: supersedingVersion, deletedBy: z.string().min(1) }),
);

/**
 * Version carried by any ticket event, for consumer-side staleness checks: the superseding
 * `version` of a deletion when present, otherwise the version of the carried ticket.
 */
export function ticketEventVersion(
  payload: { ticket: { version: number }; version?: number } | { version: number },
): number {
  if ('version' in payload && payload.version !== undefined) return payload.version;
  return (payload as { ticket: { version: number } }).ticket.version;
}
