import { Module } from '@nestjs/common';
import { OutboxRelay } from './infrastructure/outbox-relay.js';
import { RabbitMqEventPublisher } from './infrastructure/rabbitmq-event-publisher.js';
import { MessagingModule } from './messaging.module.js';
import { EVENT_PUBLISHER } from './application/ports/index.js';

/** Publishing side of the outbox: only the relay process imports this module. */
@Module({
  imports: [MessagingModule],
  providers: [{ provide: EVENT_PUBLISHER, useClass: RabbitMqEventPublisher }, OutboxRelay],
})
export class OutboxRelayModule {}
