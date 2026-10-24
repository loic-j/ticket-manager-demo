import { Module } from '@nestjs/common';
import { TicketsService } from './application/tickets.service.js';
import { TICKET_REPOSITORY } from './domain/ticket.repository.js';
import { PrismaTicketRepository } from './infrastructure/prisma-ticket.repository.js';
import { TicketsController } from './presentation/tickets.controller.js';

/** Composition root of the tickets context: binds the repository port to its adapter. */
@Module({
  controllers: [TicketsController],
  providers: [TicketsService, { provide: TICKET_REPOSITORY, useClass: PrismaTicketRepository }],
  exports: [TicketsService],
})
export class TicketsModule {}
