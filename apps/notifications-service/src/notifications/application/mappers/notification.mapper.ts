import type { Notification as NotificationView } from '@ticketmanager/contracts';
import type { Notification } from '../../domain/notification.js';

/**
 * Boundary between the domain and the API contract: the view exposes what the recipient may see
 * (no `userId`, no delivery bookkeeping) with ISO dates. A divergence between the two shapes is
 * a compile error here and nowhere else.
 */
export function toNotificationView(notification: Notification): NotificationView {
  return {
    id: notification.id,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    ticketId: notification.ticketId,
    readAt: notification.readAt?.toISOString() ?? null,
    email: notification.email,
    createdAt: notification.createdAt.toISOString(),
  };
}
