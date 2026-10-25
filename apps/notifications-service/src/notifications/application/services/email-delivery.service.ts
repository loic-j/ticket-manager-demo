import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  emailFailed,
  emailSent,
  type EmailDelivery,
  type Notification,
} from '../../domain/notification.js';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../../domain/notification.repository.js';
import { MAILER, USER_DIRECTORY, type Mailer, type UserDirectory } from '../ports/index.js';

/**
 * Sends the email of a stored notification and records the outcome. Never throws: a failure
 * (directory down, no address, SMTP error) is written to the row and retried later by the email
 * retry worker, so the broker message can be acked once the notification is persisted.
 * Delivery is at-least-once: when `updateEmail` fails after a successful send, the row stays
 * `pending`/`failed` and the worker may send the same email again.
 */
@Injectable()
export class EmailDeliveryService {
  private readonly logger = new Logger(EmailDeliveryService.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  async deliver(notification: Notification): Promise<'sent' | 'failed'> {
    let outcome: 'sent' | 'failed';
    let delivery: EmailDelivery;
    try {
      const profile = await this.users.findById(notification.userId);
      if (!profile?.email) {
        throw new Error('recipient has no email address');
      }
      await this.mailer.send({
        to: profile.email,
        subject: notification.title,
        text: `${profile.name ? `Hi ${profile.name},\n\n` : ''}${notification.body}`,
      });
      delivery = emailSent(notification);
      outcome = 'sent';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      delivery = emailFailed(notification, message);
      outcome = 'failed';
      this.logger.warn(
        `Email for notification ${notification.id} failed (attempt ${delivery.emailAttempts}): ${message}`,
      );
    }
    try {
      await this.notifications.updateEmail(notification.id, delivery);
    } catch (error) {
      // The row keeps its previous status and the retry worker picks it up again (possibly
      // re-sending an email that did go out: at-least-once).
      this.logger.error(`Could not record email status of ${notification.id}: ${String(error)}`);
    }
    return outcome;
  }
}
