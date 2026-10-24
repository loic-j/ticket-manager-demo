import { TicketNotFoundError } from '../domain/ticket-not-found.error.js';
import { InMemoryTicketRepository } from '../infrastructure/in-memory-ticket.repository.js';
import { TicketsService } from './tickets.service.js';

describe('TicketsService', () => {
  let service: TicketsService;

  beforeEach(() => {
    service = new TicketsService(new InMemoryTicketRepository());
  });

  it('creates a ticket as open and lists it', async () => {
    const created = await service.create({
      title: 'Broken keyboard',
      description: '',
      priority: 'high',
    });
    expect(created.status).toBe('open');
    expect(await service.findAll()).toEqual([created]);
  });

  it('updates a ticket and bumps updatedAt', async () => {
    const created = await service.create({ title: 'A', description: '', priority: 'low' });
    const updated = await service.update(created.id, { status: 'resolved' });
    expect(updated.status).toBe('resolved');
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it('throws TicketNotFoundError for unknown ids', async () => {
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(TicketNotFoundError);
    await expect(service.remove('missing')).rejects.toBeInstanceOf(TicketNotFoundError);
  });
});
