import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { NotificationNotFoundError } from '../../domain/notification-not-found.error.js';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../../domain/notification.repository.js';
import { MarkNotificationReadCommand } from './mark-notification-read.command.js';

@CommandHandler(MarkNotificationReadCommand)
export class MarkNotificationReadHandler implements ICommandHandler<
  MarkNotificationReadCommand,
  void
> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
  ) {}

  async execute({ notificationId, userId }: MarkNotificationReadCommand): Promise<void> {
    const notification = await this.notifications.findById(notificationId);
    // Another user's notification is reported as missing, not forbidden, to avoid leaking ids.
    if (!notification || notification.userId !== userId) {
      throw new NotificationNotFoundError(notificationId);
    }
    await this.notifications.markRead(notificationId, new Date());
  }
}
