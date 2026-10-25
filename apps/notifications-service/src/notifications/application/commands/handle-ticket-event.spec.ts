import type { TicketStatus } from '@ticketmanager/contracts';
import { ticketChangedV1, ticketCreatedV1, ticketDeletedV1 } from '@ticketmanager/events';
import { EmailDeliveryService } from '../services/email-delivery.service.js';
import {
  CapturingMailer,
  ImmediateUnitOfWork,
  InMemoryNotificationRepository,
  InMemoryProcessedEvents,
  InMemoryTicketVersions,
  StaticUserProfiles,
} from '../../infrastructure/testing.js';
import { HandleTicketEventCommand } from './handle-ticket-event.command.js';
import { HandleTicketEventHandler } from './handle-ticket-event.handler.js';
import { MarkNotificationReadCommand } from './mark-notification-read.command.js';
import { MarkNotificationReadHandler } from './mark-notification-read.handler.js';

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
const created = () => ticketCreatedV1.create({ ticket });
const changed = (version: number, status: TicketStatus, previousStatus: TicketStatus = 'open') =>
  ticketChangedV1.create({
    ticket: { ...ticket, version, status },
    changes: { status: { from: previousStatus, to: status } },
  });
const retitled = (version: number, title: string) =>
  ticketChangedV1.create({
    ticket: { ...ticket, version, title },
    changes: { title: { from: ticket.title, to: title } },
  });
const deleted = (version: number) =>
  ticketDeletedV1.create({ ticketId: ticket.id, version, deletedBy: 'u1' });

function setup(users: StaticUserProfiles) {
  const repo = new InMemoryNotificationRepository();
  const mailer = new CapturingMailer();
  const processed = new InMemoryProcessedEvents();
  const versions = new InMemoryTicketVersions();
  const handler = new HandleTicketEventHandler(
    repo,
    processed,
    versions,
    new ImmediateUnitOfWork(),
    new EmailDeliveryService(repo, users, mailer),
  );
  return { repo, mailer, processed, versions, handler };
}
const knownUser = () => new StaticUserProfiles({ u1: { email: 'u1@example.com', name: 'Una' } });

describe('HandleTicketEventHandler', () => {
  it('stores a notification for the creator and emails them', async () => {
    const { repo, mailer, handler } = setup(knownUser());
    expect(await handler.execute(new HandleTicketEventCommand(created()))).toBe('created');
    expect([...repo.rows.values()][0]).toMatchObject({
      kind: 'ticket_created',
      ticketId: ticket.id,
      email: 'sent',
      emailAttempts: 1,
    });
    expect(mailer.sent).toEqual([
      {
        to: 'u1@example.com',
        subject: 'Ticket created: Printer on fire',
        text: expect.stringContaining('Hi Una,'),
      },
    ]);
  });

  it('acks duplicates without a second notification or email', async () => {
    const { repo, mailer, handler } = setup(knownUser());
    const event = created();
    await handler.execute(new HandleTicketEventCommand(event));
    expect(await handler.execute(new HandleTicketEventCommand(event))).toBe('duplicate');
    expect(repo.rows.size).toBe(1);
    expect(mailer.sent).toHaveLength(1);
  });

  it('ignores stale versions whatever the delivery order', async () => {
    const { repo, handler } = setup(knownUser());
    expect(
      await handler.execute(new HandleTicketEventCommand(changed(3, 'closed', 'resolved'))),
    ).toBe('created');
    expect(await handler.execute(new HandleTicketEventCommand(changed(2, 'resolved')))).toBe(
      'stale',
    );
    expect(await handler.execute(new HandleTicketEventCommand(created()))).toBe('stale'); // version 1 after 3
    expect([...repo.rows.values()].map((n) => n.kind)).toEqual(['ticket_status_changed']);
  });

  it('ignores events that produce no notification but still records their version', async () => {
    const { repo, handler, processed, versions } = setup(knownUser());
    expect(await handler.execute(new HandleTicketEventCommand(retitled(2, 'Printer OK')))).toBe(
      'ignored',
    );
    expect(versions.versions.get(ticket.id)).toBe(2);
    expect(processed.ids.size).toBe(1);
    expect(await handler.execute(new HandleTicketEventCommand(deleted(3)))).toBe('ignored');
    expect(versions.versions.get(ticket.id)).toBe(3);
    expect(repo.rows.size).toBe(0);
  });

  it('treats a status change older than a deletion as stale', async () => {
    const { repo, handler } = setup(knownUser());
    expect(await handler.execute(new HandleTicketEventCommand(deleted(3)))).toBe('ignored');
    expect(await handler.execute(new HandleTicketEventCommand(changed(2, 'resolved')))).toBe(
      'stale',
    );
    expect(repo.rows.size).toBe(0);
  });

  it('ignores an unknown event type without touching the inbox', async () => {
    const { handler, processed } = setup(knownUser());
    const envelope = { ...created(), type: 'ticket.archived' };
    expect(await handler.execute(new HandleTicketEventCommand(envelope))).toBe('ignored');
    expect(processed.ids.size).toBe(0);
  });

  it('ignores a known event type with an invalid payload without claiming it', async () => {
    const { handler, processed, versions } = setup(knownUser());
    const envelope = { ...created(), payload: { ticket: { ...ticket, status: 'on-fire' } } };
    expect(await handler.execute(new HandleTicketEventCommand(envelope))).toBe('ignored');
    expect(processed.ids.size).toBe(0);
    expect(versions.versions.size).toBe(0);
  });

  it('keeps the notification as failed when the recipient has no email', async () => {
    const { repo, mailer, handler } = setup(new StaticUserProfiles({}));
    await handler.execute(new HandleTicketEventCommand(created()));
    expect([...repo.rows.values()][0]).toMatchObject({
      email: 'failed',
      emailError: 'recipient has no email address',
    });
    expect(mailer.sent).toHaveLength(0);
  });

  it('keeps the notification as failed when the directory is down (retried later)', async () => {
    const users = knownUser();
    users.failWith = new Error('logto unreachable');
    const { repo, handler } = setup(users);
    expect(await handler.execute(new HandleTicketEventCommand(created()))).toBe('created');
    expect([...repo.rows.values()][0]).toMatchObject({
      email: 'failed',
      emailError: 'logto unreachable',
      emailAttempts: 1,
    });
  });

  it('records a transport failure without losing the notification', async () => {
    const { repo, mailer, handler } = setup(knownUser());
    mailer.failWith = new Error('smtp down');
    await handler.execute(new HandleTicketEventCommand(created()));
    expect([...repo.rows.values()][0]).toMatchObject({ email: 'failed', emailError: 'smtp down' });
  });
});

describe('MarkNotificationReadHandler', () => {
  it('marks only the owner notification as read and keeps the email status', async () => {
    const { repo, handler: ingest } = setup(knownUser());
    await ingest.execute(new HandleTicketEventCommand(created()));
    const id = [...repo.rows.keys()][0]!;
    const handler = new MarkNotificationReadHandler(repo);

    await expect(
      handler.execute(new MarkNotificationReadCommand(id, 'someone-else')),
    ).rejects.toThrow('not found');
    await handler.execute(new MarkNotificationReadCommand(id, 'u1'));
    expect(repo.rows.get(id)).toMatchObject({ email: 'sent' });
    expect(repo.rows.get(id)?.readAt).not.toBeNull();
  });
});
