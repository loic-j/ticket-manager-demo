import { Module } from '@nestjs/common';
import { TicketsService } from './application/tickets.service.js';
import { TICKET_REPOSITORY } from './domain/ticket.repository.js';
import { InMemoryTicketRepository } from './infrastructure/in-memory-ticket.repository.js';
import { TicketsController } from './presentation/tickets.controller.js';

/** Composition root of the tickets context: binds the repository port to its adapter. */
@Module({
  controllers: [TicketsController],
  providers: [TicketsService, { provide: TICKET_REPOSITORY, useClass: InMemoryTicketRepository }],
  exports: [TicketsService],
})
export class TicketsModule {}
