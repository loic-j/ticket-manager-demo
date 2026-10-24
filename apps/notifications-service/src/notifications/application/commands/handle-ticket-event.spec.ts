import { ticketCreatedV1, ticketDeletedV1, ticketStatusChangedV1 } from '@ticketmanager/events';
import { EmailDeliveryService } from '../email-delivery.service.js';
import {
  CapturingMailer,
  ImmediateUnitOfWork,
  InMemoryNotificationRepository,
  InMemoryProcessedEvents,
  StaticUserDirectory,
} from '../../infrastructure/testing.js';
import { HandleTicketEventCommand } from './handle-ticket-event.command.js';
import { HandleTicketEventHandler } from './handle-ticket-event.handler.js';
import { MarkNotificationReadCommand } from './mark-notification-read.command.js';
import { MarkNotificationReadHandler } from './mark-notification-read.handler.js';
import { notificationFor } from './ticket-event-notifications.js';

const ticketId = '2f6a3c4e-5b1d-4e8a-9c7f-1a2b3c4d5e6f';
const created = () =>
  ticketCreatedV1.create({
    ticketId,
    title: 'Printer on fire',
    priority: 'urgent',
    createdBy: 'u1',
  });

function setup(users: StaticUserDirectory) {
  const repo = new InMemoryNotificationRepository();
  const mailer = new CapturingMailer();
  const emails = new EmailDeliveryService(repo, users, mailer);
  const handler = new HandleTicketEventHandler(
    repo,
    new InMemoryProcessedEvents(),
    new ImmediateUnitOfWork(),
    emails,
  );
  return { repo, mailer, handler };
}

describe('HandleTicketEventHandler', () => {
  const knownUser = () => new StaticUserDirectory({ u1: { email: 'u1@example.com', name: 'Una' } });

  it('stores a notification for the creator and emails them', async () => {
    const { repo, mailer, handler } = setup(knownUser());
    expect(await handler.execute(new HandleTicketEventCommand(created()))).toBe('created');
    const [row] = [...repo.rows.values()];
    expect(row).toMatchObject({
      kind: 'ticket_created',
      ticketId,
      email: 'sent',
      emailAttempts: 1,
      readAt: null,
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

  it('ignores events that produce no notification', async () => {
    const { repo, handler } = setup(knownUser());
    const event = ticketDeletedV1.create({ ticketId, deletedBy: 'u1' });
    expect(await handler.execute(new HandleTicketEventCommand(event))).toBe('ignored');
    expect(repo.rows.size).toBe(0);
  });

  it('keeps the notification as failed when the recipient has no email', async () => {
    const { repo, mailer, handler } = setup(new StaticUserDirectory({}));
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

describe('notificationFor', () => {
  it('describes a status change for the creator', () => {
    const event = ticketStatusChangedV1.create({
      ticketId,
      title: 'Printer',
      from: 'open',
      to: 'in_progress',
      changedBy: 'agent',
      createdBy: 'u1',
    });
    expect(notificationFor(event)).toMatchObject({
      userId: 'u1',
      kind: 'ticket_status_changed',
      title: 'Ticket in progress: Printer',
    });
  });
});

describe('MarkNotificationReadHandler', () => {
  it('marks only the owner notification as read and keeps the email status', async () => {
    const { repo, handler: ingest } = setup(
      new StaticUserDirectory({ u1: { email: 'u1@example.com', name: null } }),
    );
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
