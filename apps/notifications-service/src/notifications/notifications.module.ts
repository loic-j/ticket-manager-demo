import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { NOTIFICATION_COMMAND_HANDLERS } from './application/commands/index.js';
import {
  MAILER,
  NOTIFICATION_READ_REPOSITORY,
  PROCESSED_EVENTS,
  UNIT_OF_WORK,
  USER_DIRECTORY,
} from './application/ports/index.js';
import { EmailDeliveryService } from './application/email-delivery.service.js';
import { NOTIFICATION_QUERY_HANDLERS } from './application/queries/index.js';
import { NOTIFICATION_REPOSITORY } from './domain/notification.repository.js';
import { EmailRetryJob } from './infrastructure/email-retry.job.js';
import { LogtoUserDirectory } from './infrastructure/logto-user-directory.js';
import {
  PrismaNotificationReadRepository,
  PrismaNotificationRepository,
} from './infrastructure/prisma-notification.repository.js';
import { PrismaProcessedEvents } from './infrastructure/prisma-processed-events.js';
import { PrismaUnitOfWork } from './infrastructure/prisma-unit-of-work.js';
import { SmtpMailer } from './infrastructure/smtp-mailer.js';
import { NOTIFICATIONS_CONFIG, loadNotificationsConfig } from './notifications.config.js';
import { NotificationsController } from './presentation/notifications.controller.js';

@Module({
  imports: [CqrsModule],
  controllers: [NotificationsController],
  providers: [
    ...NOTIFICATION_COMMAND_HANDLERS,
    ...NOTIFICATION_QUERY_HANDLERS,
    EmailDeliveryService,
    EmailRetryJob,
    {
      provide: NOTIFICATIONS_CONFIG,
      useFactory: (config: ConfigService) => loadNotificationsConfig(config),
      inject: [ConfigService],
    },
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
    { provide: NOTIFICATION_READ_REPOSITORY, useClass: PrismaNotificationReadRepository },
    { provide: PROCESSED_EVENTS, useClass: PrismaProcessedEvents },
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
    { provide: USER_DIRECTORY, useClass: LogtoUserDirectory },
    { provide: MAILER, useClass: SmtpMailer },
  ],
  exports: [CqrsModule],
})
export class NotificationsModule {}
