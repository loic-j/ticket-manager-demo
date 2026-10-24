import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { Ticket } from '@ticketmanager/contracts';
import { TicketNotFoundError } from '../../domain/ticket-not-found.error.js';
import {
  TICKET_READ_REPOSITORY,
  type TicketReadRepository,
} from '../ports/ticket-read.repository.js';
import { GetTicketQuery } from './get-ticket.query.js';

@QueryHandler(GetTicketQuery)
export class GetTicketHandler implements IQueryHandler<GetTicketQuery, Ticket> {
  constructor(@Inject(TICKET_READ_REPOSITORY) private readonly tickets: TicketReadRepository) {}

  async execute({ ticketId }: GetTicketQuery): Promise<Ticket> {
    const ticket = await this.tickets.getById(ticketId);
    if (!ticket) {
      throw new TicketNotFoundError(ticketId);
    }
    return ticket;
  }
}
