import type { Ticket as TicketView } from '@ticketmanager/contracts';

export const TICKET_CACHE = Symbol('TICKET_CACHE');

/**
 * Cache of the API views served by the read side (cache-aside). Query adapters fill it, command
 * handlers call `evict()` once their unit of work has committed, so a change is visible on the
 * next read instead of after the TTL. Like every cache port it never throws: a miss is the worst
 * outcome of an unavailable backend.
 */
export interface TicketCache {
  getTicket(id: string): Promise<TicketView | undefined>;
  setTicket(ticket: TicketView): Promise<void>;
  getList(): Promise<TicketView[] | undefined>;
  setList(tickets: TicketView[]): Promise<void>;
  /** Drops the entry of one ticket and the list (which contained it or will contain it). */
  evict(ticketId: string): Promise<void>;
}
