import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { Ticket } from '@ticketmanager/contracts';
import {
  TICKET_READ_REPOSITORY,
  type TicketReadRepository,
} from '../ports/ticket-read.repository.js';
import { ListTicketsQuery } from './list-tickets.query.js';

@QueryHandler(ListTicketsQuery)
export class ListTicketsHandler implements IQueryHandler<ListTicketsQuery, Ticket[]> {
  constructor(@Inject(TICKET_READ_REPOSITORY) private readonly tickets: TicketReadRepository) {}

  execute(): Promise<Ticket[]> {
    return this.tickets.list();
  }
}
