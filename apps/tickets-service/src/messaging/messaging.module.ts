import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaOutbox } from './infrastructure/prisma-outbox.js';
import { PrismaUnitOfWork } from './infrastructure/prisma-unit-of-work.js';
import { MESSAGING_CONFIG, loadMessagingConfig } from './messaging.config.js';
import { OUTBOX, UNIT_OF_WORK } from './application/ports/index.js';

/**
 * Outbox write side for command handlers (unit of work + outbox). The publishing side lives in
 * `OutboxRelayModule`, started by the dedicated relay process (`main.relay.ts`), never by the
 * HTTP process.
 */
@Global()
@Module({
  providers: [
    {
      provide: MESSAGING_CONFIG,
      useFactory: (config: ConfigService) => loadMessagingConfig(config),
      inject: [ConfigService],
    },
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
    { provide: OUTBOX, useClass: PrismaOutbox },
  ],
  exports: [MESSAGING_CONFIG, UNIT_OF_WORK, OUTBOX],
})
export class MessagingModule {}
