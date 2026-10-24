import type { Ticket } from '@ticketmanager/contracts';
import type { Ticket as TicketRow } from '../../generated/prisma/client.js';

/** Explicit mapping between Prisma rows and the ticket shape shared by both ports. */
export function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
    createdAt: new Date(ticket.createdAt),
    updatedAt: new Date(ticket.updatedAt),
  };
}
