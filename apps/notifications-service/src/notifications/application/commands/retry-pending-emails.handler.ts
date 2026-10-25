import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../../domain/notification.repository.js';
import { EMAIL_RETRY_POLICY, type EmailRetryPolicy } from '../ports/index.js';
import { EmailDeliveryService } from '../services/email-delivery.service.js';
import { RetryPendingEmailsCommand } from './retry-pending-emails.command.js';

/** Rows claimed per run; the next tick picks up the rest. */
export const EMAIL_RETRY_BATCH_SIZE = 50;

/**
 * Re-sends emails that are still `pending` (crash between commit and send) or `failed`
 * (directory or SMTP error), until the policy's `maxAttempts`. Claiming stamps the rows, so several
 * workers never pick the same notification. Returns the number of notifications retried.
 */
@CommandHandler(RetryPendingEmailsCommand)
export class RetryPendingEmailsHandler implements ICommandHandler<
  RetryPendingEmailsCommand,
  number
> {
  constructor(
    @Inject(EMAIL_RETRY_POLICY) private readonly policy: EmailRetryPolicy,
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    private readonly emails: EmailDeliveryService,
  ) {}

  async execute({ now }: RetryPendingEmailsCommand): Promise<number> {
    const candidates = await this.notifications.claimEmailRetryCandidates({
      maxAttempts: this.policy.maxAttempts,
      notTriedSince: new Date(now.getTime() - this.policy.retryDelayMs),
      limit: EMAIL_RETRY_BATCH_SIZE,
      now,
    });
    for (const notification of candidates) {
      await this.emails.deliver(notification);
    }
    return candidates.length;
  }
}
