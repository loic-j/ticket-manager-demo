import { EmailDeliveryService } from '../application/services/email-delivery.service.js';
import { createNotification } from '../domain/notification.js';
import { loadNotificationsConfig } from '../notifications.config.js';
import { EmailRetryJob } from './email-retry.job.js';
import { CapturingMailer, InMemoryNotificationRepository, StaticUserDirectory } from './testing.js';

describe('EmailRetryJob', () => {
  const config = loadNotificationsConfig({ EMAIL_MAX_ATTEMPTS: '2', EMAIL_RETRY_DELAY_MS: '1000' });

  it('re-sends failed and pending emails until the attempt limit', async () => {
    const repo = new InMemoryNotificationRepository();
    const mailer = new CapturingMailer();
    const emails = new EmailDeliveryService(
      repo,
      new StaticUserDirectory({ u1: { email: 'u1@x.io', name: null } }),
      mailer,
    );
    const job = new EmailRetryJob(config, repo, emails);
    const old = new Date(Date.now() - 10_000).toISOString();
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
});
