import { Inject, Injectable } from '@nestjs/common';
import type { CreateTicketDto, UpdateTicketDto } from '@ticketmanager/contracts';
import { TicketNotFoundError } from '../domain/ticket-not-found.error.js';
import { TICKET_REPOSITORY, type TicketRepository } from '../domain/ticket.repository.js';
import { createTicket, updateTicket, type ActorId, type Ticket } from '../domain/ticket.js';

/** Use cases. Depends on the repository port only, never on a concrete store. */
@Injectable()
export class TicketsService {
  constructor(@Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository) {}

  findAll(): Promise<Ticket[]> {
    return this.tickets.findAll();
  }

  async findOne(id: string): Promise<Ticket> {
    const ticket = await this.tickets.findById(id);
    if (!ticket) {
      throw new TicketNotFoundError(id);
    }
    return ticket;
  }

  async create(dto: CreateTicketDto, actor: ActorId): Promise<Ticket> {
    const ticket = createTicket(dto, actor);
    await this.tickets.save(ticket);
    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto, actor: ActorId): Promise<Ticket> {
    const ticket = updateTicket(await this.findOne(id), dto, actor);
    await this.tickets.save(ticket);
    return ticket;
  }

  async remove(id: string): Promise<void> {
    if (!(await this.tickets.delete(id))) {
      throw new TicketNotFoundError(id);
    }
  }
}
