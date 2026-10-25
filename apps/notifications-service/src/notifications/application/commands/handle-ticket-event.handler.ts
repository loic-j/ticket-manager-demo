import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { createNotification } from '../../domain/notification.js';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../../domain/notification.repository.js';
import { EmailDeliveryService } from '../services/email-delivery.service.js';
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
 * every known ticket event advances the version, including those producing no notification, so
 * one carrying a version lower than the last seen for its ticket is stale and ignored. Once the
 * transaction committed the message is safe to ack whatever the email outcome: the delivery
 * status lives on the row and the email retry worker retries failures.
 */
@CommandHandler(HandleTicketEventCommand)
export class HandleTicketEventHandler implements ICommandHandler<
  HandleTicketEventCommand,
  HandleTicketEventResult
> {
  private readonly logger = new Logger(HandleTicketEventHandler.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    @Inject(PROCESSED_EVENTS) private readonly processed: ProcessedEvents,
    @Inject(TICKET_VERSIONS) private readonly versions: TicketVersions,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    private readonly emails: EmailDeliveryService,
  ) {}

  async execute({ envelope }: HandleTicketEventCommand): Promise<HandleTicketEventResult> {
    const event = notificationFor(envelope);
    if (event.kind === 'unknown') {
      if (event.reason === 'invalid-payload') {
        this.logger.warn(`${envelope.type} v${envelope.version} ${envelope.id}: invalid payload`);
      }
      return 'ignored';
    }

    const outcome = await this.unitOfWork.run(async () => {
      if (!(await this.processed.claim(envelope.id, envelope.type))) {
        return 'duplicate' as const;
      }
      if (!(await this.versions.advance(event.ticketId, event.version))) {
        return 'stale' as const;
      }
      if (!event.draft) {
        return 'ignored' as const;
      }
      const created = createNotification({ ...event.draft, eventId: envelope.id });
      await this.notifications.insert(created);
      return created;
    });
    if (typeof outcome === 'string') {
      return outcome;
    }

    await this.emails.deliver(outcome);
    return 'created';
  }
}
