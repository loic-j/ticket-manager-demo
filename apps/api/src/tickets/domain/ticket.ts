import type {
  CreateTicketDto,
  Ticket as TicketContract,
  UpdateTicketDto,
} from '@ticketmanager/shared';

/**
 * Domain model of a ticket. It currently matches the API contract from `@ticketmanager/shared`
 * one to one; split the two here if persistence or business rules ever need to diverge.
 */
export type Ticket = TicketContract;

export function createTicket(dto: CreateTicketDto): Ticket {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    ...dto,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
}

export function updateTicket(ticket: Ticket, dto: UpdateTicketDto): Ticket {
  return { ...ticket, ...dto, updatedAt: new Date().toISOString() };
}
