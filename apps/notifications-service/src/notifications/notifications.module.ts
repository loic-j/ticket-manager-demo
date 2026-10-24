import { Module } from '@nestjs/common';
import { NotificationsCoreModule } from './notifications-core.module.js';
import { NotificationsController } from './presentation/notifications.controller.js';

/** HTTP face of the notifications context. */
@Module({
  imports: [NotificationsCoreModule],
  controllers: [NotificationsController],
  exports: [NotificationsCoreModule],
})
export class NotificationsModule {}
