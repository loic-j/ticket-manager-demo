import type { Ticket } from './ticket.js';

/** Injection token for the repository port (interfaces do not exist at runtime). */
export const TICKET_REPOSITORY = Symbol('TICKET_REPOSITORY');

/** Persistence port. Implemented in `infrastructure/`; the application layer only sees this. */
export interface TicketRepository {
  findAll(): Promise<Ticket[]>;
  findById(id: string): Promise<Ticket | null>;
  /** Inserts or replaces the ticket with the same id. */
  save(ticket: Ticket): Promise<void>;
  /** @returns `true` if a ticket was deleted. */
  delete(id: string): Promise<boolean>;
}
