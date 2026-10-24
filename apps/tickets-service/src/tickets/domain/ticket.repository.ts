import type { Ticket } from './ticket.js';

/** Injection token for the write-side repository port (interfaces do not exist at runtime). */
export const TICKET_REPOSITORY = Symbol('TICKET_REPOSITORY');

export interface FindOptions {
  /** Lock the row for the rest of the ambient unit of work (read-modify-write). */
  forUpdate?: boolean;
}

/**
 * Write-side persistence port (command handlers only). Implemented in `infrastructure/`; the
 * application layer only sees this. Reads for the API go through `TicketReadRepository`.
 */
export interface TicketRepository {
  findById(id: string, options?: FindOptions): Promise<Ticket | null>;
  /** Inserts or replaces the ticket with the same id. */
  save(ticket: Ticket): Promise<void>;
  /** @returns `true` if a ticket was deleted. */
  delete(id: string): Promise<boolean>;
}
