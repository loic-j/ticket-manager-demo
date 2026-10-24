import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { Notification } from '@ticketmanager/contracts';
import {
  NOTIFICATION_READ_REPOSITORY,
  type NotificationReadRepository,
} from '../ports/notification-read.repository.js';
import { ListNotificationsQuery } from './list-notifications.query.js';

@QueryHandler(ListNotificationsQuery)
export class ListNotificationsHandler implements IQueryHandler<
  ListNotificationsQuery,
  Notification[]
> {
  constructor(
    @Inject(NOTIFICATION_READ_REPOSITORY)
    private readonly notifications: NotificationReadRepository,
  ) {}

  execute({ userId }: ListNotificationsQuery): Promise<Notification[]> {
    return this.notifications.listForUser(userId);
  }
}
