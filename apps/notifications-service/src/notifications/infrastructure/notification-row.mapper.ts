import type { Notification as NotificationView } from '@ticketmanager/contracts';
import type { Notification as NotificationRow } from '../../generated/prisma/client.js';
import type { Notification } from '../domain/notification.js';

export function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    title: row.title,
    body: row.body,
    ticketId: row.ticketId,
    eventId: row.eventId,
    readAt: row.readAt?.toISOString() ?? null,
    email: row.email,
    emailError: row.emailError,
    emailAttempts: row.emailAttempts,
    emailLastTriedAt: row.emailLastTriedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Strips the fields the API must not expose. */
export function toView(notification: Notification): NotificationView {
  const { id, kind, title, body, ticketId, readAt, email, createdAt } = notification;
  return { id, kind, title, body, ticketId, readAt, email, createdAt };
}

export function toRow(notification: Notification): NotificationRow {
  return {
    id: notification.id,
    userId: notification.userId,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    ticketId: notification.ticketId,
    eventId: notification.eventId,
    readAt: notification.readAt ? new Date(notification.readAt) : null,
    email: notification.email,
    emailError: notification.emailError,
    emailAttempts: notification.emailAttempts,
    emailLastTriedAt: notification.emailLastTriedAt
      ? new Date(notification.emailLastTriedAt)
      : null,
    createdAt: new Date(notification.createdAt),
  };
}
