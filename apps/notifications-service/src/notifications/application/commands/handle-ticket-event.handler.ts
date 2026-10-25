import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ticketEventVersion } from '@ticketmanager/events';
import { createNotification } from '../../domain/notification.js';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../../domain/notification.repository.js';
import { EmailDeliveryService } from '../email-delivery.service.js';
import {
  PROCESSED_EVENTS,
  TICKET_VERSIONS,
  UNIT_OF_WORK,
  type ProcessedEvents,
  type TicketVersions,
  type UnitOfWork,
} from '../ports/index.js';
import { HandleTicketEventCommand } from './handle-ticket-event.command.js';
import { notificationFor } from './ticket-event-notifications.js';

export type HandleTicketEventResult = 'created' | 'duplicate' | 'stale' | 'ignored';

/**
 * Inbox pattern: claim the event id, advance the ticket version and store the notification in
 * one transaction, then send the email outside it. Events are not assumed to arrive in order:
 * one carrying a version lower than the last seen for its ticket is stale and ignored. Once the transaction committed the message is safe to ack whatever the
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
    @Inject(TICKET_VERSIONS) private readonly versions: TicketVersions,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    private readonly emails: EmailDeliveryService,
  ) {}

  async execute({ envelope }: HandleTicketEventCommand): Promise<HandleTicketEventResult> {
    const draft = notificationFor(envelope);
    if (!draft) {
      return 'ignored';
    }

    const outcome = await this.unitOfWork.run(async () => {
      if (!(await this.processed.claim(envelope.id, envelope.type))) {
        return 'duplicate' as const;
      }
      const version = ticketEventVersion(
        envelope.payload as Parameters<typeof ticketEventVersion>[0],
      );
      if (!(await this.versions.advance(draft.ticketId, version))) {
        return 'stale' as const;
      }
      const created = createNotification({ ...draft, eventId: envelope.id });
      await this.notifications.insert(created);
      return created;
    });
    if (typeof outcome === 'string') {
      return outcome;
    }
    const notification = outcome;

    await this.emails.deliver(notification);
    return 'created';
  }
}
