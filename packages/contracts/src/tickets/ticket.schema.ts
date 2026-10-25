import { z } from 'zod';
import { userIdSchema } from '../auth/auth.schema.js';

export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES);
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;

export const ticketIdSchema = z.uuid();

/** A ticket as returned by the API. */
export const ticketSchema = z.object({
  id: ticketIdSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  /** Logto user id (`sub`) of the creator. */
  createdBy: userIdSchema,
  /** Logto user id (`sub`) of the last editor. */
  updatedBy: userIdSchema,
  /** Optimistic-concurrency version, 1 at creation, +1 per change. Also orders the events. */
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Ticket = z.infer<typeof ticketSchema>;

/** Payload accepted by `POST /tickets`. */
export const createTicketSchema = z.object({
  title: ticketSchema.shape.title,
  description: ticketSchema.shape.description.default(''),
  priority: ticketPrioritySchema.default('medium'),
});
/** What the client sends (defaults optional). */
export type CreateTicketInput = z.input<typeof createTicketSchema>;
/** What the server receives after validation (defaults applied). */
export type CreateTicketDto = z.output<typeof createTicketSchema>;

/** Payload accepted by `PATCH /tickets/:id`. */
export const updateTicketSchema = z
  .object({
    title: ticketSchema.shape.title,
    description: ticketSchema.shape.description,
    status: ticketStatusSchema,
    priority: ticketPrioritySchema,
  })
  .partial();
export type UpdateTicketDto = z.infer<typeof updateTicketSchema>;

/**
 * Full body of `PATCH /tickets/:id`: the editable fields plus an optional `expectedVersion`.
 * When present, the update is rejected with 409 if the stored version differs, so a client that
 * edits from a stale copy never silently overwrites someone else's change.
 */
export const updateTicketBodySchema = updateTicketSchema.extend({
  expectedVersion: ticketSchema.shape.version.optional(),
});
export type UpdateTicketBody = z.infer<typeof updateTicketBodySchema>;
