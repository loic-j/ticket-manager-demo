import {
  TicketChangedEvent,
  TicketCreatedEvent,
  type TicketDomainEvent,
} from './events/ticket-events.js';

/**
 * Domain model of a ticket, owned by this layer: no import from the API contract, the ORM or
 * the framework. The application layer maps DTOs in and API views out
 * (`application/mappers/ticket.mapper.ts`); the compiler keeps both shapes compatible.
 * `version` grows by one per change and backs optimistic concurrency and event ordering.
 */

export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

/** Logto user id (`sub`) of the person performing an action. */
export type ActorId = string;

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdBy: ActorId;
  updatedBy: ActorId;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/** What it takes to open a ticket. */
export interface NewTicket {
  title: string;
  description: string;
  priority: TicketPriority;
}

/** Fields an edit may change; an absent (or `undefined`) field is left untouched. */
export interface TicketPatch {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
}
export type EditableField = keyof TicketPatch;

/** Old and new value of every editable field that differs between two versions of a ticket. */
export type TicketChanges = {
  [K in EditableField]?: { from: Ticket[K]; to: Ticket[K] };
};

/** Result of a state transition: the new state plus the domain events that describe it. */
export interface TicketTransition {
  ticket: Ticket;
  events: TicketDomainEvent[];
}

export function createTicket(input: NewTicket, actor: ActorId, now = new Date()): TicketTransition {
  const ticket: Ticket = {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description,
    priority: input.priority,
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
  patch: TicketPatch,
  actor: ActorId,
  now = new Date(),
): TicketTransition {
  const changes = diffTicket(current, patch);
  if (Object.keys(changes).length === 0) {
    return { ticket: current, events: [] };
  }

  // Built from the diff (never from `patch` itself) so an explicit `undefined` cannot wipe a field.
  const applied = Object.fromEntries(
    Object.entries(changes).map(([field, change]) => [field, change.to]),
  ) as Partial<Pick<Ticket, EditableField>>;
  const ticket: Ticket = {
    ...current,
    ...applied,
    updatedBy: actor,
    version: current.version + 1,
    updatedAt: now,
  };
  return { ticket, events: [new TicketChangedEvent(ticket, changes)] };
}

/** Editable fields whose requested value differs from the current one, with both values. */
function diffTicket(current: Ticket, patch: TicketPatch): TicketChanges {
  const changes: TicketChanges = {};
  for (const key of Object.keys(patch) as EditableField[]) {
    const to = patch[key];
    if (to === undefined || to === current[key]) continue;
    // Each key is assigned its own `{ from, to }` pair; TS cannot see that `key` indexes both
    // sides with the same type, hence the targeted cast.
    (changes as Record<EditableField, unknown>)[key] = { from: current[key], to };
  }
  return changes;
}
