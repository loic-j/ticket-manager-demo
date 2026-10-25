import type { ActorId, Ticket, TicketChanges } from '../ticket.js';

/**
 * Domain events raised by the ticket aggregate. Plain classes (matched by `instanceof` when
 * mapped to integration events) with no framework import so the domain stays independent.
 */
export class TicketCreatedEvent {
  constructor(readonly ticket: Ticket) {}
}

export class TicketChangedEvent {
  constructor(
    readonly ticket: Ticket,
    /** Old and new value of every field that differs from the previous version. */
    readonly changes: TicketChanges,
  ) {}
}

export class TicketDeletedEvent {
  constructor(
    readonly ticketId: string,
    /** Last stored version + 1, so the deletion supersedes every event of the ticket. */
    readonly version: number,
    readonly deletedBy: ActorId,
  ) {}
}

export type TicketDomainEvent = TicketCreatedEvent | TicketChangedEvent | TicketDeletedEvent;
