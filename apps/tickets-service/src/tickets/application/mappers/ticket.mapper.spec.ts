import { createTicket } from '../../domain/ticket.js';
import { toNewTicket, toTicketPatch, toTicketView } from './ticket.mapper.js';

describe('ticket mapper', () => {
  it('maps the creation DTO to a NewTicket', () => {
    expect(toNewTicket({ title: 'A', description: 'd', priority: 'high' })).toEqual({
      title: 'A',
      description: 'd',
      priority: 'high',
    });
  });

  it('maps the PATCH DTO to a patch, leaving absent fields undefined', () => {
    expect(toTicketPatch({ status: 'closed' })).toEqual({
      title: undefined,
      description: undefined,
      status: 'closed',
      priority: undefined,
    });
  });

  it('renders the domain ticket as the API view with ISO dates', () => {
    const now = new Date('2026-10-26T10:00:00.000Z');
    const { ticket } = createTicket({ title: 'A', description: '', priority: 'low' }, 'u1', now);
    expect(toTicketView(ticket)).toEqual({
      id: ticket.id,
      title: 'A',
      description: '',
      status: 'open',
      priority: 'low',
      createdBy: 'u1',
      updatedBy: 'u1',
      version: 1,
      createdAt: '2026-10-26T10:00:00.000Z',
      updatedAt: '2026-10-26T10:00:00.000Z',
    });
  });
});
