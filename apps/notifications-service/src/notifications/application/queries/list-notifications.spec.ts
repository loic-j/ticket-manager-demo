import { createNotification } from '../../domain/notification.js';
import { InMemoryNotificationRepository } from '../../infrastructure/testing.js';
import { ListNotificationsHandler } from './list-notifications.handler.js';
import { ListNotificationsQuery } from './list-notifications.query.js';

describe('ListNotificationsHandler', () => {
  it('returns the caller views only, without internal fields', async () => {
    const repo = new InMemoryNotificationRepository();
    const base = {
      kind: 'ticket_created' as const,
      title: 'T',
      body: 'b',
      ticketId: crypto.randomUUID(),
    };
    await repo.insert(createNotification({ ...base, userId: 'me', eventId: crypto.randomUUID() }));
    await repo.insert(
      createNotification({ ...base, userId: 'other', eventId: crypto.randomUUID() }),
    );

    const views = await new ListNotificationsHandler(repo).execute(
      new ListNotificationsQuery('me'),
    );
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ title: 'T', email: 'pending', readAt: null });
    expect(views[0]).not.toHaveProperty('userId');
    expect(views[0]).not.toHaveProperty('emailAttempts');
  });
});
