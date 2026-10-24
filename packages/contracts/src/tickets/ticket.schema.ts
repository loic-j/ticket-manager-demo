import { z } from 'zod';

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
  createdBy: z.string().min(1),
  /** Logto user id (`sub`) of the last editor. */
  updatedBy: z.string().min(1),
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
