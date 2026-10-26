import type { Notification as NotificationRow } from '../../generated/prisma/client.js';
import type { Notification } from '../domain/notification.js';

/** Explicit mapping between Prisma rows and the domain notification (same column set). */
export function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    title: row.title,
    body: row.body,
    ticketId: row.ticketId,
    eventId: row.eventId,
    readAt: row.readAt,
    email: row.email,
    emailError: row.emailError,
    emailAttempts: row.emailAttempts,
    emailLastTriedAt: row.emailLastTriedAt,
    createdAt: row.createdAt,
  };
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
    readAt: notification.readAt,
    email: notification.email,
    emailError: notification.emailError,
    emailAttempts: notification.emailAttempts,
    emailLastTriedAt: notification.emailLastTriedAt,
    createdAt: notification.createdAt,
  };
}
