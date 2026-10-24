import { ticketPrioritySchema, ticketStatusSchema } from '@ticketmanager/contracts';
import { z } from 'zod';
import { defineEvent } from '../envelope.js';

export const ticketCreatedV1 = defineEvent(
  'ticket.created',
  1,
  z.object({
    ticketId: z.uuid(),
    title: z.string().min(1),
    priority: ticketPrioritySchema,
    createdBy: z.string().min(1),
  }),
);

export const ticketUpdatedV1 = defineEvent(
  'ticket.updated',
  1,
  z.object({
    ticketId: z.uuid(),
    changedFields: z.array(z.string().min(1)).min(1),
    updatedBy: z.string().min(1),
  }),
);

export const ticketStatusChangedV1 = defineEvent(
  'ticket.status-changed',
  1,
  z.object({
    ticketId: z.uuid(),
    title: z.string().min(1),
    from: ticketStatusSchema,
    to: ticketStatusSchema,
    changedBy: z.string().min(1),
    /** Creator of the ticket, the default recipient of notifications. */
    createdBy: z.string().min(1),
  }),
);

export const ticketDeletedV1 = defineEvent(
  'ticket.deleted',
  1,
  z.object({
    ticketId: z.uuid(),
    deletedBy: z.string().min(1),
  }),
);

/** Every ticket event, for consumers that bind `ticket.#`. */
export const TICKET_EVENTS = [
  ticketCreatedV1,
  ticketUpdatedV1,
  ticketStatusChangedV1,
  ticketDeletedV1,
] as const;
