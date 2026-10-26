import {
  ticketChangedV1,
  ticketCreatedV1,
  ticketDeletedV1,
  ticketDeletedV2,
} from '@ticketmanager/events';
import {
  NOTIFICATION_TITLE_MAX_LENGTH,
  notificationFor,
  truncate,
} from './ticket-event-notifications.js';

const ticket = {
  id: '2f6a3c4e-5b1d-4e8a-9c7f-1a2b3c4d5e6f',
  title: 'Printer on fire',
  description: '',
  status: 'open' as const,
  priority: 'urgent' as const,
  createdBy: 'u1',
  updatedBy: 'u1',
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('notificationFor', () => {
  it('describes a creation for the creator', () => {
    expect(notificationFor(ticketCreatedV1.create({ ticket }))).toEqual({
      kind: 'ticket',
      ticketId: ticket.id,
      version: 1,
      draft: {
        userId: 'u1',
        kind: 'ticket_created',
        title: 'Ticket created: Printer on fire',
        body: 'Your ticket "Printer on fire" (priority urgent) has been created.',
        ticketId: ticket.id,
      },
    });
  });

  it('describes a status change for the creator', () => {
    const event = ticketChangedV1.create({
      ticket: { ...ticket, version: 2, status: 'in_progress' },
      changes: { status: { from: 'open', to: 'in_progress' } },
    });
    expect(notificationFor(event)).toMatchObject({
      version: 2,
      draft: {
        userId: 'u1',
        kind: 'ticket_status_changed',
        title: 'Ticket in progress: Printer on fire',
        body: 'Your ticket "Printer on fire" moved from open to in_progress.',
      },
    });
  });

  it('describes any other edit for the creator, field by field', () => {
    const retitled = ticketChangedV1.create({
      ticket: { ...ticket, version: 2, title: 'Printer OK', priority: 'low', description: 'x' },
      changes: {
        title: { from: ticket.title, to: 'Printer OK' },
        priority: { from: 'urgent', to: 'low' },
        description: { from: '', to: 'x' },
      },
    });
    expect(notificationFor(retitled)).toEqual({
      kind: 'ticket',
      ticketId: ticket.id,
      version: 2,
      draft: {
        userId: 'u1',
        kind: 'ticket_updated',
        title: 'Ticket updated: Printer OK',
        body: 'Your ticket "Printer OK" has been updated: title "Printer on fire" → "Printer OK", priority urgent → low, description edited.',
        ticketId: ticket.id,
      },
    });
  });

  it('describes a deletion (v2) for the creator and only keeps the version of a v1 deletion', () => {
    const deleted = ticketDeletedV2.create({
      ticket: { ...ticket, version: 2 },
      version: 3,
      deletedBy: 'u9',
    });
    expect(notificationFor(deleted)).toEqual({
      kind: 'ticket',
      ticketId: ticket.id,
      version: 3,
      draft: {
        userId: 'u1',
        kind: 'ticket_deleted',
        title: 'Ticket deleted: Printer on fire',
        body: 'Your ticket "Printer on fire" has been deleted.',
        ticketId: ticket.id,
      },
    });
    const legacy = ticketDeletedV1.create({ ticketId: ticket.id, version: 3, deletedBy: 'u1' });
    expect(notificationFor(legacy)).toEqual({
      kind: 'ticket',
      ticketId: ticket.id,
      version: 3,
      draft: null,
    });
  });

  it('reports unknown types and invalid payloads separately', () => {
    const created = ticketCreatedV1.create({ ticket });
    expect(notificationFor({ ...created, type: 'ticket.archived' })).toEqual({
      kind: 'unknown',
      reason: 'unknown-type',
    });
    expect(notificationFor({ ...created, version: 2 })).toEqual({
      kind: 'unknown',
      reason: 'unknown-type',
    });
    expect(notificationFor({ ...created, payload: { ticket: { id: ticket.id } } })).toEqual({
      kind: 'unknown',
      reason: 'invalid-payload',
    });
  });

  it('keeps the title within the column bound for a 200-character ticket title', () => {
    const longTitle = 'x'.repeat(200);
    const outcome = notificationFor(
      ticketCreatedV1.create({ ticket: { ...ticket, title: longTitle } }),
    );
    expect(outcome.kind).toBe('ticket');
    const title = outcome.kind === 'ticket' ? outcome.draft!.title : '';
    expect(title).toHaveLength(NOTIFICATION_TITLE_MAX_LENGTH);
    expect(title.startsWith('Ticket created: xxx')).toBe(true);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('truncate', () => {
  it('leaves short titles untouched and cuts long ones with an ellipsis', () => {
    expect(NOTIFICATION_TITLE_MAX_LENGTH).toBe(200);
    expect(truncate('short')).toBe('short');
    expect(truncate('x'.repeat(200))).toBe('x'.repeat(200));
    expect(truncate('x'.repeat(201))).toBe(`${'x'.repeat(199)}…`);
    expect(truncate('abcdef', 4)).toBe('abc…');
  });
});
