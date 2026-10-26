import type { Ticket as TicketView } from '@ticketmanager/contracts';

export const TICKET_READ_REPOSITORY = Symbol('TICKET_READ_REPOSITORY');

/**
 * Read-side port (query handlers only). Returns API-shaped views straight from the store, never
 * domain objects, so the query side can later move to a denormalised read model.
 */
export interface TicketReadRepository {
  list(): Promise<TicketView[]>;
  getById(id: string): Promise<TicketView | null>;
}
