import type {
  CreateTicketDto,
  Ticket as TicketView,
  UpdateTicketDto,
} from '@ticketmanager/contracts';
import type { NewTicket, Ticket, TicketPatch } from '../../domain/ticket.js';

/**
 * Boundary between the API contract and the domain. The three functions are the only place
 * where the two shapes meet, so a divergence (new field, renamed value) is a compile error here
 * and nowhere else. Dates are `Date` in the domain and ISO strings in the API.
 */

export function toNewTicket(dto: CreateTicketDto): NewTicket {
  return { title: dto.title, description: dto.description, priority: dto.priority };
}

export function toTicketPatch(dto: UpdateTicketDto): TicketPatch {
  return {
    title: dto.title,
    description: dto.description,
    status: dto.status,
    priority: dto.priority,
  };
}

export function toTicketView(ticket: Ticket): TicketView {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    createdBy: ticket.createdBy,
    updatedBy: ticket.updatedBy,
    version: ticket.version,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}
