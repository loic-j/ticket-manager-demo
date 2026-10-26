import { createNotification } from '../../domain/notification.js';
import { toNotificationView } from './notification.mapper.js';

describe('toNotificationView', () => {
  it('exposes the recipient-facing fields only, with ISO dates', () => {
    const now = new Date('2026-10-26T10:00:00.000Z');
    const notification = createNotification(
      {
        userId: 'u1',
        kind: 'ticket_created',
        title: 'T',
        body: 'b',
        ticketId: '2f6a3c4e-5b1d-4e8a-9c7f-1a2b3c4d5e6f',
        eventId: '3f6a3c4e-5b1d-4e8a-9c7f-1a2b3c4d5e6f',
      },
      now,
    );
    expect(toNotificationView({ ...notification, readAt: now })).toEqual({
      id: notification.id,
      kind: 'ticket_created',
      title: 'T',
      body: 'b',
      ticketId: '2f6a3c4e-5b1d-4e8a-9c7f-1a2b3c4d5e6f',
      readAt: '2026-10-26T10:00:00.000Z',
      email: 'pending',
      createdAt: '2026-10-26T10:00:00.000Z',
    });
    expect(toNotificationView(notification)).not.toHaveProperty('userId');
  });
});
