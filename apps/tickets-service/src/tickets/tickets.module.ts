import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TICKET_COMMAND_HANDLERS } from './application/commands/index.js';
import { TICKET_READ_REPOSITORY } from './application/ports/ticket-read.repository.js';
import { TICKET_QUERY_HANDLERS } from './application/queries/index.js';
import { TICKET_REPOSITORY } from './domain/ticket.repository.js';
import { PrismaTicketReadRepository } from './infrastructure/prisma-ticket-read.repository.js';
import { PrismaTicketRepository } from './infrastructure/prisma-ticket.repository.js';
import { TicketsController } from './presentation/tickets.controller.js';

/** Composition root of the tickets context: binds the write and read ports to their adapters. */
@Module({
  imports: [CqrsModule],
  controllers: [TicketsController],
  providers: [
    ...TICKET_COMMAND_HANDLERS,
    ...TICKET_QUERY_HANDLERS,
    { provide: TICKET_REPOSITORY, useClass: PrismaTicketRepository },
    { provide: TICKET_READ_REPOSITORY, useClass: PrismaTicketReadRepository },
  ],
})
export class TicketsModule {}
