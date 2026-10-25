import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { ticketCreatedV1 } from '@ticketmanager/events';
import { PrismaService } from '../src/database/infrastructure/prisma.service.js';
import { PrismaOutbox } from '../src/messaging/infrastructure/prisma-outbox.js';
import { PrismaUnitOfWork } from '../src/messaging/infrastructure/prisma-unit-of-work.js';
import { createTicket } from '../src/tickets/domain/ticket.js';

/** Needs tickets-db (`pnpm infra:up`). The relay itself is tested in `packages/outbox`. */
describe('PrismaOutbox + PrismaUnitOfWork (integration)', () => {
  const prisma = new PrismaService(new ConfigService());
  const uow = new PrismaUnitOfWork(prisma);
  const outbox = new PrismaOutbox(prisma);
  const ids: string[] = [];
  // Dated in the future so a relay running against the same database ignores these rows.
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const created = (title: string) =>
    ticketCreatedV1.create(
      { ticket: createTicket({ title, description: '', priority: 'low' }, 'user_int').ticket },
      { occurredAt: inOneHour },
    );
  const row = (envelope: ReturnType<typeof created>) => ({
    envelope,
    aggregateType: 'ticket',
    aggregateId: envelope.payload.ticket.id,
  });

  afterAll(async () => {
    await prisma.db.outboxMessage.deleteMany({ where: { id: { in: ids } } });
    await prisma.onModuleDestroy();
  });

  it('stores the whole envelope in sequence order', async () => {
    const envelopes = [1, 2].map((n) => created(`Outbox ${n}`));
    ids.push(...envelopes.map((e) => e.id));
    await uow.run(() => outbox.append(envelopes.map(row)));

    const rows = await prisma.db.outboxMessage.findMany({
      where: { id: { in: ids } },
      orderBy: { sequence: 'asc' },
    });
    expect(rows.map((r) => r.id)).toEqual(envelopes.map((e) => e.id));
    expect(rows[0]).toMatchObject({
      type: 'ticket.created',
      version: 1,
      aggregateType: 'ticket',
      publishedAt: null,
      attempts: 0,
    });
    expect(rows[0]!.payload).toEqual(envelopes[0]);
  });

  it('rolls back the outbox rows when the unit of work fails, and joins nested units', async () => {
    const envelope = created('Rolled back');
    await expect(
      uow.run(async () => {
        await uow.run(() => outbox.append([row(envelope)]));
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await prisma.db.outboxMessage.findUnique({ where: { id: envelope.id } })).toBeNull();
  });
});
