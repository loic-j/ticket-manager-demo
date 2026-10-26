import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/database/infrastructure/prisma.service.js';
import { createNotification } from '../src/notifications/domain/notification.js';
import {
  PrismaNotificationReadRepository,
  PrismaNotificationRepository,
} from '../src/notifications/infrastructure/prisma-notification.repository.js';
import { PrismaProcessedEvents } from '../src/notifications/infrastructure/prisma-processed-events.js';
import { PrismaTicketVersions } from '../src/notifications/infrastructure/prisma-ticket-versions.js';
import { PrismaUnitOfWork } from '../src/notifications/infrastructure/prisma-unit-of-work.js';

/** Needs notifications-db (`pnpm infra:up`). */
describe('Prisma inbox and notifications (integration)', () => {
  let prisma: PrismaService;
  const eventIds: string[] = [];
  const notificationIds: string[] = [];
  const ticketIds: string[] = [];

  beforeAll(() => {
    prisma = new PrismaService(new ConfigService());
  });

  afterAll(async () => {
    await prisma.db.notification.deleteMany({ where: { id: { in: notificationIds } } });
    await prisma.db.processedEvent.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.db.ticketVersion.deleteMany({ where: { ticketId: { in: ticketIds } } });
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
      emailLastTriedAt: new Date(),
    });
    const stored = await repo.findById(notification.id);
    expect(stored?.readAt).not.toBeNull(); // the email update did not clear readAt
    expect(stored).toMatchObject({ email: 'failed', emailAttempts: 1 });
    const [view] = await read.listForUser(userId);
    expect(view).toMatchObject({ id: notification.id, title: 'Integration', email: 'failed' });
    expect(view).not.toHaveProperty('userId');
  });

  it('advances ticket versions monotonically', async () => {
    const versions = new PrismaTicketVersions(prisma);
    const ticketId = crypto.randomUUID();
    ticketIds.push(ticketId);
    expect(await versions.advance(ticketId, 3)).toBe(true);
    expect(await versions.advance(ticketId, 2)).toBe(false);
    expect(await versions.advance(ticketId, 3)).toBe(false);
    expect(await versions.advance(ticketId, 4)).toBe(true);
  });

  it('claims retry candidates once across concurrent workers', async () => {
    const repo = new PrismaNotificationRepository(prisma);
    const userId = `user_${crypto.randomUUID()}`;
    const old = new Date(Date.now() - 10 * 60 * 1000);
    for (let i = 0; i < 3; i++) {
      const n = createNotification({
        userId,
        kind: 'ticket_created',
        title: `Retry ${i}`,
        body: 'b',
        ticketId: crypto.randomUUID(),
        eventId: crypto.randomUUID(),
      });
      notificationIds.push(n.id);
      await repo.insert({ ...n, createdAt: old, email: 'failed', emailAttempts: 1 });
    }
    const options = {
      maxAttempts: 5,
      notTriedSince: new Date(Date.now() - 60_000),
      limit: 10,
      now: new Date(),
    };
    const [a, b] = await Promise.all([
      repo.claimEmailRetryCandidates(options),
      repo.claimEmailRetryCandidates(options),
    ]);
    const mine = [...a, ...b].filter((n) => n.userId === userId);
    expect(mine).toHaveLength(3);
    expect(new Set(mine.map((n) => n.id)).size).toBe(3); // no row claimed twice
    expect(
      (await repo.claimEmailRetryCandidates(options)).filter((n) => n.userId === userId),
    ).toHaveLength(0);
  });
});
