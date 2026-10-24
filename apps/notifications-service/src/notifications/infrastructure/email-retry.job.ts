import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { EmailDeliveryService } from '../application/email-delivery.service.js';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../domain/notification.repository.js';
import { NOTIFICATIONS_CONFIG, type NotificationsConfig } from '../notifications.config.js';

/**
 * Periodically re-sends emails that are still `pending` (crash between commit and send) or
 * `failed` (directory or SMTP error), until `emailMaxAttempts`. Single instance per process;
 * concurrent processes may send the same email twice in the worst case, which is acceptable.
 */
@Injectable()
export class EmailRetryJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailRetryJob.name);
  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<void>;

  constructor(
    @Inject(NOTIFICATIONS_CONFIG) private readonly config: NotificationsConfig,
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    private readonly emails: EmailDeliveryService,
  ) {}

  onModuleInit(): void {
    if (!this.config.emailRetryEnabled) return;
    this.timer = setInterval(() => void this.tick(), this.config.emailRetryIntervalMs);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.inFlight;
  }

  tick(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const run = this.run()
      .then(() => undefined)
      .finally(() => {
        this.inFlight = undefined;
      });
    this.inFlight = run;
    return run;
  }

  /** @returns the number of notifications retried. */
  async run(now = new Date()): Promise<number> {
    try {
      const candidates = await this.notifications.findEmailRetryCandidates({
        maxAttempts: this.config.emailMaxAttempts,
        notTriedSince: new Date(now.getTime() - this.config.emailRetryDelayMs),
        limit: 50,
      });
      for (const notification of candidates) {
        await this.emails.deliver(notification);
      }
      return candidates.length;
    } catch (error) {
      this.logger.error(`Email retry run failed: ${String(error)}`);
      return 0;
    }
  }
}
