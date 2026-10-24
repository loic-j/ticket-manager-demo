import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateTicketDto, Ticket, UpdateTicketDto } from '@ticketmanager/shared';

/** In-memory store. Replace with a real persistence layer. */
@Injectable()
export class TicketsService {
  private readonly tickets = new Map<string, Ticket>();

  constructor() {
    this.create({
      title: 'Welcome to Ticket Manager',
      description: 'Sample ticket',
      priority: 'low',
    });
  }

  findAll(): Ticket[] {
    return [...this.tickets.values()];
  }

  findOne(id: string): Ticket {
    const ticket = this.tickets.get(id);
    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }
    return ticket;
  }

  create(dto: CreateTicketDto): Ticket {
    const now = new Date().toISOString();
    const ticket: Ticket = {
      id: crypto.randomUUID(),
      ...dto,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  update(id: string, dto: UpdateTicketDto): Ticket {
    const ticket: Ticket = { ...this.findOne(id), ...dto, updatedAt: new Date().toISOString() };
    this.tickets.set(id, ticket);
    return ticket;
  }

  remove(id: string): void {
    this.findOne(id);
    this.tickets.delete(id);
  }
}
