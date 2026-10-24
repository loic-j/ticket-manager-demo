import { Injectable } from '@nestjs/common';
import type { TicketRepository } from '../domain/ticket.repository.js';
import type { Ticket } from '../domain/ticket.js';

/** Volatile store: data is lost on restart. Swap for a database-backed adapter in `TicketsModule`. */
@Injectable()
export class InMemoryTicketRepository implements TicketRepository {
  private readonly tickets = new Map<string, Ticket>();

  async findAll(): Promise<Ticket[]> {
    return [...this.tickets.values()];
  }

  async findById(id: string): Promise<Ticket | null> {
    return this.tickets.get(id) ?? null;
  }

  async save(ticket: Ticket): Promise<void> {
    this.tickets.set(ticket.id, ticket);
  }

  async delete(id: string): Promise<boolean> {
    return this.tickets.delete(id);
  }
}
