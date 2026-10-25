import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { RetryPendingEmailsCommand } from '../application/commands/index.js';
import { NOTIFICATIONS_CONFIG, type NotificationsConfig } from '../notifications.config.js';

/**
 * Inbound adapter of the email retry process (`main.email-retry.ts`): a timer dispatching
 * `RetryPendingEmailsCommand` every `emailRetryIntervalMs`. Ticks never overlap: one that fires
 * while a run is in flight joins it. Workers can be scaled, each run claims distinct rows.
 */
@Injectable()
export class EmailRetryJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailRetryJob.name);
  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<void>;

  constructor(
    @Inject(NOTIFICATIONS_CONFIG) private readonly config: NotificationsConfig,
    private readonly commandBus: CommandBus,
  ) {}

  onModuleInit(): void {
    // The timer keeps the (otherwise idle) worker process alive; `onModuleDestroy` clears it.
    this.timer = setInterval(() => void this.tick(), this.config.emailRetryIntervalMs);
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

  /** @returns the number of notifications retried; a failed run is logged and counts as 0. */
  async run(now = new Date()): Promise<number> {
    try {
      return await this.commandBus.execute<RetryPendingEmailsCommand, number>(
        new RetryPendingEmailsCommand(now),
      );
    } catch (error) {
      this.logger.error(`Email retry run failed: ${String(error)}`);
      return 0;
    }
  }
}
