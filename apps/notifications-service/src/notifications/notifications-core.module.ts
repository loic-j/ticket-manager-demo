import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { NOTIFICATION_COMMAND_HANDLERS } from './application/commands/index.js';
import { EmailDeliveryService } from './application/services/email-delivery.service.js';
import {
  EMAIL_RETRY_POLICY,
  MAILER,
  NOTIFICATION_READ_REPOSITORY,
  PROCESSED_EVENTS,
  TICKET_VERSIONS,
  UNIT_OF_WORK,
  USER_DIRECTORY,
} from './application/ports/index.js';
import { NOTIFICATION_QUERY_HANDLERS } from './application/queries/index.js';
import { NOTIFICATION_REPOSITORY } from './domain/notification.repository.js';
import { DevFallbackUserDirectory } from './infrastructure/dev-fallback-user-directory.js';
import { HttpUserDirectory } from './infrastructure/http-user-directory.js';
import {
  PrismaNotificationReadRepository,
  PrismaNotificationRepository,
} from './infrastructure/prisma-notification.repository.js';
import { PrismaProcessedEvents } from './infrastructure/prisma-processed-events.js';
import { PrismaTicketVersions } from './infrastructure/prisma-ticket-versions.js';
import { PrismaUnitOfWork } from './infrastructure/prisma-unit-of-work.js';
import { SmtpMailer } from './infrastructure/smtp-mailer.js';
import {
  NOTIFICATIONS_CONFIG,
  loadNotificationsConfig,
  type NotificationsConfig,
} from './notifications.config.js';

/**
 * Handlers, ports and adapters of the notifications context, shared by every process
 * (HTTP API + consumer, email retry worker). No controller here.
 */
@Module({
  imports: [CqrsModule],
  providers: [
    ...NOTIFICATION_COMMAND_HANDLERS,
    ...NOTIFICATION_QUERY_HANDLERS,
    EmailDeliveryService,
    {
      provide: NOTIFICATIONS_CONFIG,
      useFactory: (config: ConfigService) => loadNotificationsConfig(config),
      inject: [ConfigService],
    },
    {
      provide: EMAIL_RETRY_POLICY,
      useFactory: (config: NotificationsConfig) => ({
        maxAttempts: config.emailMaxAttempts,
        retryDelayMs: config.emailRetryDelayMs,
      }),
      inject: [NOTIFICATIONS_CONFIG],
    },
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
    { provide: NOTIFICATION_READ_REPOSITORY, useClass: PrismaNotificationReadRepository },
    { provide: PROCESSED_EVENTS, useClass: PrismaProcessedEvents },
    { provide: TICKET_VERSIONS, useClass: PrismaTicketVersions },
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
    {
      // Recipients come from directory-service; without M2M credentials (dev) a fixed address.
      provide: USER_DIRECTORY,
      useFactory: (config: NotificationsConfig) =>
        config.m2m ? new HttpUserDirectory(config) : new DevFallbackUserDirectory(config),
      inject: [NOTIFICATIONS_CONFIG],
    },
    { provide: MAILER, useClass: SmtpMailer },
  ],
  exports: [CqrsModule, EmailDeliveryService, NOTIFICATIONS_CONFIG, NOTIFICATION_REPOSITORY],
})
export class NotificationsCoreModule {}
