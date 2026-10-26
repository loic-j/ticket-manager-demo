import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NOTIFICATIONS_API_RESOURCE } from '@ticketmanager/contracts';
import { AuthModule } from '@ticketmanager/nest-common';
import { createLoggerModule } from '@ticketmanager/telemetry';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    createLoggerModule(),
    DatabaseModule,
    AuthModule.forRoot({ defaultAudience: NOTIFICATIONS_API_RESOURCE }),
    HealthModule,
    NotificationsModule,
    MessagingModule,
  ],
})
export class AppModule {}
