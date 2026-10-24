import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createNotification } from '../../domain/notification.js';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../../domain/notification.repository.js';
import { EmailDeliveryService } from '../email-delivery.service.js';
import {
  PROCESSED_EVENTS,
  UNIT_OF_WORK,
  type ProcessedEvents,
  type UnitOfWork,
} from '../ports/index.js';
import { HandleTicketEventCommand } from './handle-ticket-event.command.js';
import { notificationFor } from './ticket-event-notifications.js';

export type HandleTicketEventResult = 'created' | 'duplicate' | 'ignored';

/**
 * Inbox pattern: claim the event id and store the notification in one transaction, then send
 * the email outside it. Once the transaction committed the message is safe to ack whatever the
 * email outcome: the delivery status lives on the row and `EmailRetryJob` retries failures.
 */
@CommandHandler(HandleTicketEventCommand)
export class HandleTicketEventHandler implements ICommandHandler<
  HandleTicketEventCommand,
  HandleTicketEventResult
> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    @Inject(PROCESSED_EVENTS) private readonly processed: ProcessedEvents,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    private readonly emails: EmailDeliveryService,
  ) {}

  async execute({ envelope }: HandleTicketEventCommand): Promise<HandleTicketEventResult> {
    const draft = notificationFor(envelope);
    if (!draft) {
      return 'ignored';
    }

    const notification = await this.unitOfWork.run(async () => {
      if (!(await this.processed.claim(envelope.id, envelope.type))) {
        return null;
      }
      const created = createNotification({ ...draft, eventId: envelope.id });
      await this.notifications.insert(created);
      return created;
    });
    if (!notification) {
      return 'duplicate';
    }

    await this.emails.deliver(notification);
    return 'created';
  }
}
