import type { Ticket as TicketView } from '@ticketmanager/contracts';
import type { TicketReadRepository } from '../application/ports/ticket-read.repository.js';
import type { TicketCache } from '../application/ports/ticket-cache.js';

/**
 * Cache-aside decorator of the read port: serves a view from the cache when present, otherwise
 * reads the inner repository and fills the cache. Missing tickets are not cached (the next
 * create of that id, if any, would have to evict a negative entry). Invalidation is the command
 * handlers' job (`TicketCache.evict()` after commit); the TTL bounds staleness when a reader
 * refilled the cache with a value read just before a commit.
 */
export class CachingTicketReadRepository implements TicketReadRepository {
  constructor(
    private readonly inner: TicketReadRepository,
    private readonly cache: TicketCache,
  ) {}

  async list(): Promise<TicketView[]> {
    const cached = await this.cache.getList();
    if (cached) return cached;
    const tickets = await this.inner.list();
    await this.cache.setList(tickets);
    return tickets;
  }

  async getById(id: string): Promise<TicketView | null> {
    const cached = await this.cache.getTicket(id);
    if (cached) return cached;
    const ticket = await this.inner.getById(id);
    if (ticket) await this.cache.setTicket(ticket);
    return ticket;
  }
}
