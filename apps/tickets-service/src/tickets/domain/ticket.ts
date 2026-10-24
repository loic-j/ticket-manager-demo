import type {
  CreateTicketDto,
  Ticket as TicketContract,
  UpdateTicketDto,
} from '@ticketmanager/contracts';
import {
  TicketCreatedEvent,
  TicketStatusChangedEvent,
  TicketUpdatedEvent,
  type TicketDomainEvent,
} from './events/ticket-events.js';

/**
 * Domain model of a ticket. It currently matches the API contract from `@ticketmanager/contracts`
 * one to one; split the two here if persistence or business rules ever need to diverge.
 */
export type Ticket = TicketContract;

/** Logto user id (`sub`) of the person performing an action. */
export type ActorId = string;

/** Result of a state transition: the new state plus the domain events that describe it. */
export interface TicketTransition {
  ticket: Ticket;
  events: TicketDomainEvent[];
}

export function createTicket(dto: CreateTicketDto, actor: ActorId): TicketTransition {
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id: crypto.randomUUID(),
    ...dto,
    status: 'open',
    createdBy: actor,
    updatedBy: actor,
    createdAt: now,
    updatedAt: now,
  };
  return { ticket, events: [new TicketCreatedEvent(ticket)] };
}

export function updateTicket(
  current: Ticket,
  dto: UpdateTicketDto,
  actor: ActorId,
): TicketTransition {
  const changedFields = (Object.keys(dto) as (keyof UpdateTicketDto)[]).filter(
    (key) => dto[key] !== undefined && dto[key] !== current[key],
  );
  if (changedFields.length === 0) {
    return { ticket: current, events: [] };
  }

  const ticket: Ticket = {
    ...current,
    ...dto,
    updatedBy: actor,
    updatedAt: new Date().toISOString(),
  };
  const events: TicketDomainEvent[] = [new TicketUpdatedEvent(ticket, changedFields)];
  if (ticket.status !== current.status) {
    events.push(new TicketStatusChangedEvent(ticket, current.status, ticket.status));
  }
  return { ticket, events };
}
