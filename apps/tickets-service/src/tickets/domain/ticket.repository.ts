import type { Ticket } from './ticket.js';

/** Injection token for the write-side repository port (interfaces do not exist at runtime). */
export const TICKET_REPOSITORY = Symbol('TICKET_REPOSITORY');

/**
 * Write-side persistence port (command handlers only). Implemented in `infrastructure/`; the
 * application layer only sees this. Reads for the API go through `TicketReadRepository`.
 * Concurrency is optimistic: `update` only applies when the stored version is the one the
 * caller read (`ticket.version - 1`).
 */
export interface TicketRepository {
  findById(id: string): Promise<Ticket | null>;
  insert(ticket: Ticket): Promise<void>;
  /** @returns `false` when the stored version differs (concurrent change) or the row is gone. */
  update(ticket: Ticket): Promise<boolean>;
  /** Atomic: @returns the ticket as it was deleted, or `null` if it (no longer) existed. */
  delete(id: string): Promise<Ticket | null>;
}
