import { Inject, Injectable } from '@nestjs/common';
import type { Ticket as TicketView } from '@ticketmanager/contracts';
import { CACHE_STORE, type CacheStore } from '../../caching/application/ports/index.js';
import { CACHING_CONFIG, type CachingConfig } from '../../caching/caching.config.js';
import type { TicketCache } from '../application/ports/ticket-cache.js';

const LIST_KEY = 'tickets';
const ticketKey = (id: string) => `ticket:${id}`;

/** `TicketCache` on top of the shared `CacheStore`, one key per ticket plus one for the list. */
@Injectable()
export class CacheStoreTicketCache implements TicketCache {
  constructor(
    @Inject(CACHE_STORE) private readonly store: CacheStore,
    @Inject(CACHING_CONFIG) private readonly config: Pick<CachingConfig, 'ttlMs'>,
  ) {}

  getTicket(id: string): Promise<TicketView | undefined> {
    return this.store.get<TicketView>(ticketKey(id));
  }

  setTicket(ticket: TicketView): Promise<void> {
    return this.store.set(ticketKey(ticket.id), ticket, this.config.ttlMs);
  }

  getList(): Promise<TicketView[] | undefined> {
    return this.store.get<TicketView[]>(LIST_KEY);
  }

  setList(tickets: TicketView[]): Promise<void> {
    return this.store.set(LIST_KEY, tickets, this.config.ttlMs);
  }

  evict(ticketId: string): Promise<void> {
    return this.store.delete(ticketKey(ticketId), LIST_KEY);
  }
}
