import { TicketNotFoundError } from '../../domain/ticket-not-found.error.js';
import { createTicket } from '../../domain/ticket.js';
import { InMemoryTicketRepository } from '../../infrastructure/testing.js';
import { GetTicketHandler } from './get-ticket.handler.js';
import { GetTicketQuery } from './get-ticket.query.js';
import { ListTicketsHandler } from './list-tickets.handler.js';

describe('ticket query handlers', () => {
  it('lists and gets tickets from the read port', async () => {
    const store = new InMemoryTicketRepository();
    const { ticket } = createTicket({ title: 'A', description: '', priority: 'low' }, 'user_a');
    await store.insert(ticket);

    expect(await new ListTicketsHandler(store).execute()).toEqual([ticket]);
    expect(await new GetTicketHandler(store).execute(new GetTicketQuery(ticket.id))).toEqual(
      ticket,
    );
    await expect(
      new GetTicketHandler(store).execute(new GetTicketQuery('missing')),
    ).rejects.toBeInstanceOf(TicketNotFoundError);
  });
});
