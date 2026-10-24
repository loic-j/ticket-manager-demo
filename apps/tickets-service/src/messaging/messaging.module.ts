import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxRelay } from './infrastructure/outbox-relay.js';
import { PrismaOutbox } from './infrastructure/prisma-outbox.js';
import { PrismaUnitOfWork } from './infrastructure/prisma-unit-of-work.js';
import { RabbitMqEventPublisher } from './infrastructure/rabbitmq-event-publisher.js';
import { MESSAGING_CONFIG, loadMessagingConfig } from './messaging.config.js';
import { EVENT_PUBLISHER, OUTBOX, UNIT_OF_WORK } from './ports/index.js';

/** Transactional outbox: unit of work + outbox for handlers, relay + broker publisher. */
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
    { provide: EVENT_PUBLISHER, useClass: RabbitMqEventPublisher },
    OutboxRelay,
  ],
  exports: [UNIT_OF_WORK, OUTBOX],
})
export class MessagingModule {}
