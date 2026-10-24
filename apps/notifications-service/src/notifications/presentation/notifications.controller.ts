import { Controller, Get, HttpCode, Param, Post, UseFilters } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { notificationIdSchema, type AuthUser, type Notification } from '@ticketmanager/contracts';
import { CurrentUser } from '@ticketmanager/nest-common';
import { MarkNotificationReadCommand } from '../application/commands/index.js';
import { ListNotificationsQuery } from '../application/queries/index.js';
import { NotificationErrorsFilter } from './notification-errors.filter.js';

/** The caller only ever sees their own notifications (recipient = token `sub`). */
@Controller('notifications')
@UseFilters(NotificationErrorsFilter)
export class NotificationsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<Notification[]> {
    return this.queryBus.execute<ListNotificationsQuery, Notification[]>(
      new ListNotificationsQuery(user.sub),
    );
  }

  @Post(':id/read')
  @HttpCode(204)
  async markRead(
    @Param('id', { schema: notificationIdSchema }) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.commandBus.execute<MarkNotificationReadCommand, void>(
      new MarkNotificationReadCommand(id, user.sub),
    );
  }
}
