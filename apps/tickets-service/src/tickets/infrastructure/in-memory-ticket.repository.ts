import { Injectable } from '@nestjs/common';
import type { TicketReadRepository } from '../application/ports/ticket-read.repository.js';
import type { TicketRepository } from '../domain/ticket.repository.js';
import type { Ticket } from '../domain/ticket.js';

/**
 * Volatile store used by unit and e2e tests. One instance serves both the write and the read
 * port so that a command is immediately visible to queries; bind the same instance to both tokens.
 */
@Injectable()
export class InMemoryTicketRepository implements TicketRepository, TicketReadRepository {
  private readonly tickets = new Map<string, Ticket>();

  // Write side
  async findById(id: string): Promise<Ticket | null> {
    return this.tickets.get(id) ?? null;
  }

  async save(ticket: Ticket): Promise<void> {
    this.tickets.set(ticket.id, ticket);
  }

  async delete(id: string): Promise<boolean> {
    return this.tickets.delete(id);
  }

  // Read side
  async list(): Promise<Ticket[]> {
    return [...this.tickets.values()];
  }

  getById(id: string): Promise<Ticket | null> {
    return this.findById(id);
  }
}
