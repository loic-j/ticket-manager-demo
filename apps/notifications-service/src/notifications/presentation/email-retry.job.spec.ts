import type { CommandBus } from '@nestjs/cqrs';
import {
  RetryPendingEmailsCommand,
  RetryPendingEmailsHandler,
} from '../application/commands/index.js';
import { EmailDeliveryService } from '../application/services/email-delivery.service.js';
import { createNotification } from '../domain/notification.js';
import {
  CapturingMailer,
  InMemoryNotificationRepository,
  StaticUserProfiles,
} from '../infrastructure/testing.js';
import { loadNotificationsConfig } from '../notifications.config.js';
import { EmailRetryJob } from './email-retry.job.js';

describe('EmailRetryJob', () => {
  const config = loadNotificationsConfig({
    EMAIL_MAX_ATTEMPTS: '2',
    EMAIL_RETRY_DELAY_MS: '15000',
    EMAIL_RETRY_INTERVAL_MS: '1000',
  });

  function setup() {
    const repo = new InMemoryNotificationRepository();
    const mailer = new CapturingMailer();
    const emails = new EmailDeliveryService(
      repo,
      new StaticUserProfiles({ u1: { email: 'u1@x.io', name: null } }),
      mailer,
    );
    const handler = new RetryPendingEmailsHandler(
      { maxAttempts: config.emailMaxAttempts, retryDelayMs: config.emailRetryDelayMs },
      repo,
      emails,
    );
    const executions: RetryPendingEmailsCommand[] = [];
    const commandBus = {
      execute: (command: RetryPendingEmailsCommand) => {
        executions.push(command);
        return handler.execute(command);
      },
    } as unknown as CommandBus;
    return { repo, mailer, executions, job: new EmailRetryJob(config, commandBus) };
  }

  it('re-sends failed and pending emails until the attempt limit', async () => {
    const { repo, mailer, job } = setup();
    const old = new Date(Date.now() - 60_000).toISOString();
    const base = {
      userId: 'u1',
      kind: 'ticket_created' as const,
      title: 'T',
      body: 'b',
      ticketId: crypto.randomUUID(),
    };
    const pending = {
      ...createNotification({ ...base, eventId: crypto.randomUUID() }),
      createdAt: old,
    };
    const failed = {
      ...createNotification({ ...base, eventId: crypto.randomUUID() }),
      createdAt: old,
      email: 'failed' as const,
      emailAttempts: 1,
      emailLastTriedAt: old,
    };
    const exhausted = { ...failed, id: crypto.randomUUID(), emailAttempts: 2 };
    const fresh = createNotification({ ...base, eventId: crypto.randomUUID() }); // too recent
    for (const n of [pending, failed, exhausted, fresh]) await repo.insert(n);

    expect(await job.run()).toBe(2);
    expect(mailer.sent).toHaveLength(2);
    expect(repo.rows.get(pending.id)).toMatchObject({ email: 'sent', emailAttempts: 1 });
    expect(repo.rows.get(failed.id)).toMatchObject({ email: 'sent', emailAttempts: 2 });
    expect(repo.rows.get(exhausted.id)).toMatchObject({ email: 'failed', emailAttempts: 2 });
    expect(repo.rows.get(fresh.id)).toMatchObject({ email: 'pending', emailLastTriedAt: null });
    expect(await job.run()).toBe(0);
  });

  it('logs a failed run instead of throwing', async () => {
    const { job } = setup();
    const failing = new EmailRetryJob(config, {
      execute: async () => {
        throw new Error('db down');
      },
    } as unknown as CommandBus);
    expect(await failing.run()).toBe(0);
    expect(await job.run()).toBe(0);
  });

  it('ticks on the interval, never overlaps runs and stops on destroy', async () => {
    vi.useFakeTimers();
    try {
      const { executions, job } = setup();
      job.onModuleInit();
      const first = job.tick();
      expect(job.tick()).toBe(first); // a tick during a run joins it
      await first;
      expect(executions).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(2500);
      expect(executions).toHaveLength(3);
      await job.onModuleDestroy();
      await vi.advanceTimersByTimeAsync(5000);
      expect(executions).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
