import type {
  CreateTicketDto,
  Ticket as TicketContract,
  UpdateTicketDto,
} from '@ticketmanager/contracts';

/**
 * Domain model of a ticket. It currently matches the API contract from `@ticketmanager/contracts`
 * one to one; split the two here if persistence or business rules ever need to diverge.
 */
export type Ticket = TicketContract;

/** Logto user id (`sub`) of the person performing an action. */
export type ActorId = string;

export function createTicket(dto: CreateTicketDto, actor: ActorId): Ticket {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    ...dto,
    status: 'open',
    createdBy: actor,
    updatedBy: actor,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateTicket(ticket: Ticket, dto: UpdateTicketDto, actor: ActorId): Ticket {
  return { ...ticket, ...dto, updatedBy: actor, updatedAt: new Date().toISOString() };
}
