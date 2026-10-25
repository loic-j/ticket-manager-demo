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

  async insert(ticket: Ticket): Promise<void> {
    if (this.tickets.has(ticket.id)) throw new Error(`duplicate ticket ${ticket.id}`);
    this.tickets.set(ticket.id, ticket);
  }

  async update(ticket: Ticket): Promise<boolean> {
    const current = this.tickets.get(ticket.id);
    if (!current || current.version !== ticket.version - 1) return false;
    this.tickets.set(ticket.id, ticket);
    return true;
  }

  async delete(id: string): Promise<Ticket | null> {
    const current = this.tickets.get(id) ?? null;
    this.tickets.delete(id);
    return current;
  }

  // Read side
  async list(): Promise<Ticket[]> {
    return [...this.tickets.values()];
  }

  getById(id: string): Promise<Ticket | null> {
    return this.findById(id);
  }
}
