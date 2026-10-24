import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTicket } from '../src/tickets/domain/ticket.js';
import { PrismaTicketRepository } from '../src/tickets/infrastructure/prisma-ticket.repository.js';

describe('PrismaTicketRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaTicketRepository;
  const created: string[] = [];

  beforeAll(() => {
    prisma = new PrismaService(new ConfigService());
    repository = new PrismaTicketRepository(prisma);
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
  });

  it('round-trips a ticket through PostgreSQL', async () => {
    const ticket = createTicket({
      title: 'Integration',
      description: 'from test',
      priority: 'high',
    });
    created.push(ticket.id);

    await repository.save(ticket);
    expect(await repository.findById(ticket.id)).toEqual(ticket);
    expect((await repository.findAll()).map((t) => t.id)).toContain(ticket.id);

    await repository.save({ ...ticket, status: 'resolved' });
    expect((await repository.findById(ticket.id))?.status).toBe('resolved');

    expect(await repository.delete(ticket.id)).toBe(true);
    expect(await repository.delete(ticket.id)).toBe(false);
    expect(await repository.findById(ticket.id)).toBeNull();
  });
});
