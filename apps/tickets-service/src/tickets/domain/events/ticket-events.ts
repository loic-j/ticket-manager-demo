import type { Ticket } from '../ticket.js';

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
    /** Keys of the fields that changed, e.g. `['title', 'priority']`. */
    readonly changedFields: readonly string[],
    readonly previousStatus: Ticket['status'],
  ) {}
}

export class TicketDeletedEvent {
  constructor(
    readonly ticketId: string,
    readonly version: number,
    readonly deletedBy: string,
  ) {}
}

export type TicketDomainEvent = TicketCreatedEvent | TicketChangedEvent | TicketDeletedEvent;
