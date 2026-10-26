import type { Ticket as TicketRow } from '../../generated/prisma/client.js';
import type { Ticket } from '../domain/ticket.js';

/** Explicit mapping between Prisma rows and the domain ticket (the read side renders views from it). */
export function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toTicketRow(ticket: Ticket): TicketRow {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    createdBy: ticket.createdBy,
    updatedBy: ticket.updatedBy,
    version: ticket.version,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

/** Columns a change may touch; identity and creation columns never move after insert. */
export function toTicketUpdate(
  ticket: Ticket,
): Pick<
  TicketRow,
  'title' | 'description' | 'status' | 'priority' | 'updatedBy' | 'version' | 'updatedAt'
> {
  return {
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    updatedBy: ticket.updatedBy,
    version: ticket.version,
    updatedAt: ticket.updatedAt,
  };
}
