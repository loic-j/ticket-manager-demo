import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/database/prisma.service.js';
import { createNotification } from '../src/notifications/domain/notification.js';
import {
  PrismaNotificationReadRepository,
  PrismaNotificationRepository,
} from '../src/notifications/infrastructure/prisma-notification.repository.js';
import { PrismaProcessedEvents } from '../src/notifications/infrastructure/prisma-processed-events.js';
import { PrismaUnitOfWork } from '../src/notifications/infrastructure/prisma-unit-of-work.js';

/** Needs notifications-db (`pnpm infra:up`). */
describe('Prisma inbox and notifications (integration)', () => {
  let prisma: PrismaService;
  const eventIds: string[] = [];
  const notificationIds: string[] = [];

  beforeAll(() => {
    prisma = new PrismaService(new ConfigService());
  });

  afterAll(async () => {
    await prisma.db.notification.deleteMany({ where: { id: { in: notificationIds } } });
    await prisma.db.processedEvent.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.onModuleDestroy();
  });

  it('claims an event once and rolls the claim back with the unit of work', async () => {
    const processed = new PrismaProcessedEvents(prisma);
    const uow = new PrismaUnitOfWork(prisma);
    const eventId = crypto.randomUUID();
    eventIds.push(eventId);

    await expect(
      uow.run(async () => {
        expect(await processed.claim(eventId, 'ticket.created')).toBe(true);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await processed.claim(eventId, 'ticket.created')).toBe(true); // claim was rolled back
    expect(await processed.claim(eventId, 'ticket.created')).toBe(false);
  });

  it('round-trips a notification and lists it as a view', async () => {
    const repo = new PrismaNotificationRepository(prisma);
    const read = new PrismaNotificationReadRepository(prisma);
    const userId = `user_${crypto.randomUUID()}`;
    const notification = createNotification({
      userId,
      kind: 'ticket_created',
      title: 'Integration',
      body: 'body',
      ticketId: crypto.randomUUID(),
      eventId: crypto.randomUUID(),
    });
    notificationIds.push(notification.id);

    await repo.insert(notification);
    expect(await repo.findById(notification.id)).toEqual(notification);
    await repo.markRead(notification.id, new Date());
    await repo.updateEmail(notification.id, {
      email: 'failed',
      emailError: 'x',
      emailAttempts: 1,
      emailLastTriedAt: new Date().toISOString(),
    });
    const stored = await repo.findById(notification.id);
    expect(stored?.readAt).not.toBeNull(); // the email update did not clear readAt
    expect(stored).toMatchObject({ email: 'failed', emailAttempts: 1 });
    const [view] = await read.listForUser(userId);
    expect(view).toMatchObject({ id: notification.id, title: 'Integration', email: 'failed' });
    expect(view).not.toHaveProperty('userId');
  });
});
