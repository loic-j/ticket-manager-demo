import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTicket } from '../src/tickets/domain/ticket.js';
import { PrismaTicketReadRepository } from '../src/tickets/infrastructure/prisma-ticket-read.repository.js';
import { PrismaTicketRepository } from '../src/tickets/infrastructure/prisma-ticket.repository.js';

describe('PrismaTicketRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaTicketRepository;
  let readRepository: PrismaTicketReadRepository;
  const created: string[] = [];

  beforeAll(() => {
    prisma = new PrismaService(new ConfigService());
    repository = new PrismaTicketRepository(prisma);
    readRepository = new PrismaTicketReadRepository(prisma);
  });

  afterAll(async () => {
    await prisma.db.ticket.deleteMany({ where: { id: { in: created } } });
    await prisma.onModuleDestroy();
  });

  it('round-trips a ticket through PostgreSQL', async () => {
    const { ticket } = createTicket(
      { title: 'Integration', description: 'from test', priority: 'high' },
      'user_int',
    );
    created.push(ticket.id);

    await repository.insert(ticket);
    expect(await repository.findById(ticket.id)).toEqual(ticket);
    expect(await readRepository.getById(ticket.id)).toEqual(ticket);
    expect((await readRepository.list()).map((t) => t.id)).toContain(ticket.id);

    const v2 = { ...ticket, status: 'resolved' as const, version: 2 };
    expect(await repository.update(v2)).toBe(true);
    expect(await repository.update(v2)).toBe(false); // stale: stored version is already 2
    expect((await repository.findById(ticket.id))?.status).toBe('resolved');

    expect(await repository.delete(ticket.id)).toMatchObject({ id: ticket.id, version: 2 });
    expect(await repository.delete(ticket.id)).toBeNull();
    expect(await repository.findById(ticket.id)).toBeNull();
  });
});
