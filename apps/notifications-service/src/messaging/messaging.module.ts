import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsCoreModule } from '../notifications/notifications-core.module.js';
import { CONSUMER_CONFIG, loadConsumerConfig } from './messaging.config.js';
import { TicketEventsConsumer } from './presentation/ticket-events.consumer.js';

/** Inbound side: the RabbitMQ consumer dispatching ticket events to the command bus. */
@Module({
  imports: [NotificationsCoreModule],
  providers: [
    {
      provide: CONSUMER_CONFIG,
      useFactory: (config: ConfigService) => loadConsumerConfig(config),
      inject: [ConfigService],
    },
    TicketEventsConsumer,
  ],
})
export class MessagingModule {}
