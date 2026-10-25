import { ticketChangedV1, ticketCreatedV1 } from '@ticketmanager/events';
import { createTicket, updateTicket } from '../../domain/ticket.js';
import { toIntegrationEvents } from './ticket-integration-events.js';

describe('toIntegrationEvents', () => {
  it('maps a creation to ticket.created with the full state', () => {
    const { ticket, events } = createTicket({ title: 'A', description: '', priority: 'low' }, 'u1');
    const [out] = toIntegrationEvents(events, 'u1');
    expect(out).toMatchObject({ aggregateType: 'ticket', aggregateId: ticket.id });
    expect(ticketCreatedV1.is(out!.envelope)).toBe(true);
    expect(out!.envelope.payload).toEqual({ ticket });
    expect(out!.envelope.actor).toBe('u1');
  });

  it('maps a change to ticket.changed with the new state, version 2 and the previous status', () => {
    const { ticket } = createTicket({ title: 'A', description: '', priority: 'low' }, 'u1');
    const { events } = updateTicket(ticket, { status: 'closed' }, 'u2');
    const [out] = toIntegrationEvents(events, 'u2').map((e) => e.envelope);
    expect(ticketChangedV1.is(out!)).toBe(true);
    expect(out!.payload).toMatchObject({
      ticket: { id: ticket.id, status: 'closed', version: 2, updatedBy: 'u2' },
      changedFields: ['status'],
      previousStatus: 'open',
    });
  });
});
