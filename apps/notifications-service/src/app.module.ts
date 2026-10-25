import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NOTIFICATIONS_API_RESOURCE } from '@ticketmanager/contracts';
import { AuthModule } from '@ticketmanager/nest-common';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/presentation/health.controller.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule.forRoot({ defaultAudience: NOTIFICATIONS_API_RESOURCE }),
    NotificationsModule,
    MessagingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
