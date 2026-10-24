import { ticketCreatedV1, ticketStatusChangedV1, ticketUpdatedV1 } from '@ticketmanager/events';
import { createTicket, updateTicket } from '../../domain/ticket.js';
import { toIntegrationEvents } from './ticket-integration-events.js';

describe('toIntegrationEvents', () => {
  it('maps a creation to ticket.created v1', () => {
    const { ticket, events } = createTicket({ title: 'A', description: '', priority: 'low' }, 'u1');
    const [out] = toIntegrationEvents(events, 'u1');
    expect(out).toMatchObject({ aggregateType: 'ticket', aggregateId: ticket.id });
    expect(ticketCreatedV1.is(out!.envelope)).toBe(true);
    expect(out!.envelope.payload).toEqual({
      ticketId: ticket.id,
      title: 'A',
      priority: 'low',
      createdBy: 'u1',
    });
    expect(out!.envelope.actor).toBe('u1');
  });

  it('maps a status change to updated + status-changed', () => {
    const { ticket } = createTicket({ title: 'A', description: '', priority: 'low' }, 'u1');
    const { events } = updateTicket(ticket, { status: 'closed' }, 'u2');
    const out = toIntegrationEvents(events, 'u2').map((e) => e.envelope);
    expect(out).toHaveLength(2);
    expect(ticketUpdatedV1.is(out[0]!)).toBe(true);
    expect(ticketStatusChangedV1.is(out[1]!)).toBe(true);
    expect(out[1]!.payload).toMatchObject({
      from: 'open',
      to: 'closed',
      changedBy: 'u2',
      createdBy: 'u1',
    });
  });
});
