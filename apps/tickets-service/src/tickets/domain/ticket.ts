import type {
  CreateTicketDto,
  Ticket as TicketContract,
  UpdateTicketDto,
} from '@ticketmanager/contracts';
import {
  TicketChangedEvent,
  TicketCreatedEvent,
  type TicketDomainEvent,
} from './events/ticket-events.js';

/**
 * Domain model of a ticket. It currently matches the API contract from `@ticketmanager/contracts`
 * one to one; split the two here if persistence or business rules ever need to diverge.
 * `version` grows by one per change and backs optimistic concurrency and event ordering.
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
    version: 1,
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
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  };
  return { ticket, events: [new TicketChangedEvent(ticket, changedFields, current.status)] };
}
