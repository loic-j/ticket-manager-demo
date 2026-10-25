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

/** Fields a client may edit through `PATCH /tickets/:id`. */
export type EditableField = keyof UpdateTicketDto;

/** Old and new value of every editable field that differs between two versions of a ticket. */
export type TicketChanges = {
  [K in EditableField]?: { from: Ticket[K]; to: Ticket[K] };
};

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
  const changes = diffTicket(current, dto);
  if (Object.keys(changes).length === 0) {
    return { ticket: current, events: [] };
  }

  const ticket: Ticket = {
    ...current,
    ...dto,
    updatedBy: actor,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  };
  return { ticket, events: [new TicketChangedEvent(ticket, changes)] };
}

/** Editable fields whose requested value differs from the current one, with both values. */
function diffTicket(current: Ticket, dto: UpdateTicketDto): TicketChanges {
  const changes: TicketChanges = {};
  for (const key of Object.keys(dto) as EditableField[]) {
    const to = dto[key];
    if (to === undefined || to === current[key]) continue;
    // Each key is assigned its own `{ from, to }` pair; TS cannot see that `key` indexes both
    // sides with the same type, hence the targeted cast.
    (changes as Record<EditableField, unknown>)[key] = { from: current[key], to };
  }
  return changes;
}
