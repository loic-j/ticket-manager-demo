import { Global, Module } from '@nestjs/common';
import { PrismaOutbox } from './infrastructure/prisma-outbox.js';
import { PrismaUnitOfWork } from './infrastructure/prisma-unit-of-work.js';
import { OUTBOX, UNIT_OF_WORK } from './application/ports/index.js';

/**
 * Outbox write side for command handlers (unit of work + outbox rows). Publishing is done by
 * `apps/tickets-relay-service` (built on `@ticketmanager/outbox`), never by this process.
 */
@Global()
@Module({
  providers: [
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
    { provide: OUTBOX, useClass: PrismaOutbox },
  ],
  exports: [UNIT_OF_WORK, OUTBOX],
})
export class MessagingModule {}
