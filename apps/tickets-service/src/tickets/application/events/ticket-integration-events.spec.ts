import { ticketChangedV1, ticketCreatedV1, ticketDeletedV2 } from '@ticketmanager/events';
import { TicketDeletedEvent } from '../../domain/events/ticket-events.js';
import { createTicket, updateTicket } from '../../domain/ticket.js';
import { toTicketView } from '../mappers/ticket.mapper.js';
import { toIntegrationEvents } from './ticket-integration-events.js';

describe('toIntegrationEvents', () => {
  it('maps a creation to ticket.created with the full state', () => {
    const { ticket, events } = createTicket({ title: 'A', description: '', priority: 'low' }, 'u1');
    const [out] = toIntegrationEvents(events, 'u1');
    expect(out).toMatchObject({ aggregateType: 'ticket', aggregateId: ticket.id });
    expect(ticketCreatedV1.is(out!.envelope)).toBe(true);
    expect(out!.envelope.payload).toEqual({ ticket: toTicketView(ticket) });
    expect(out!.envelope.actor).toBe('u1');
  });

  it('maps a change to ticket.changed with the new state, version 2 and the field changes', () => {
    const { ticket } = createTicket({ title: 'A', description: '', priority: 'low' }, 'u1');
    const { events } = updateTicket(ticket, { status: 'closed' }, 'u2');
    const [out] = toIntegrationEvents(events, 'u2').map((e) => e.envelope);
    expect(ticketChangedV1.is(out!)).toBe(true);
    expect(out!.payload).toMatchObject({
      ticket: { id: ticket.id, status: 'closed', version: 2, updatedBy: 'u2' },
      changes: { status: { from: 'open', to: 'closed' } },
    });
  });

  it('maps a deletion to ticket.deleted v2 with the last state, the superseding version and the actor', () => {
    const { ticket } = createTicket({ title: 'A', description: '', priority: 'low' }, 'u1');
    const [out] = toIntegrationEvents([new TicketDeletedEvent(ticket, 2, 'u3')], 'u3');
    expect(out).toMatchObject({ aggregateType: 'ticket', aggregateId: ticket.id });
    expect(ticketDeletedV2.is(out!.envelope)).toBe(true);
    expect(out!.envelope.payload).toEqual({
      ticket: toTicketView(ticket),
      version: 2,
      deletedBy: 'u3',
    });
    expect(out!.envelope.actor).toBe('u3');
  });
});
