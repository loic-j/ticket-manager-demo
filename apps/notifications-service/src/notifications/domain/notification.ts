/**
 * Domain model of a notification, owned by this layer: no import from the API contract, the ORM
 * or the framework. The application layer renders the API view
 * (`application/mappers/notification.mapper.ts`); the compiler keeps both shapes compatible.
 */

export const NOTIFICATION_KINDS = ['ticket_created', 'ticket_status_changed'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const EMAIL_DELIVERY_STATUSES = ['pending', 'sent', 'failed'] as const;
export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number];

/** Longest error message kept on a notification (the column is TEXT; this bounds log noise). */
const MAX_EMAIL_ERROR_LENGTH = 1000;

export interface Notification {
  id: string;
  /** Logto user id (`sub`) of the recipient. */
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  ticketId: string;
  /** Id of the integration event that produced this notification. */
  eventId: string;
  readAt: Date | null;
  email: EmailDeliveryStatus;
  emailError: string | null;
  emailAttempts: number;
  emailLastTriedAt: Date | null;
  createdAt: Date;
}

export type EmailDelivery = Pick<
  Notification,
  'email' | 'emailError' | 'emailAttempts' | 'emailLastTriedAt'
>;

export interface NewNotification {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  ticketId: string;
  eventId: string;
}

export function createNotification(input: NewNotification, now = new Date()): Notification {
  return {
    id: crypto.randomUUID(),
    userId: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    ticketId: input.ticketId,
    eventId: input.eventId,
    readAt: null,
    email: 'pending',
    emailError: null,
    emailAttempts: 0,
    emailLastTriedAt: null,
    createdAt: now,
  };
}

export function emailSent(notification: Notification, at = new Date()): EmailDelivery {
  return {
    email: 'sent',
    emailError: null,
    emailAttempts: notification.emailAttempts + 1,
    emailLastTriedAt: at,
  };
}

export function emailFailed(
  notification: Notification,
  error: string,
  at = new Date(),
): EmailDelivery {
  return {
    email: 'failed',
    emailError: error.slice(0, MAX_EMAIL_ERROR_LENGTH),
    emailAttempts: notification.emailAttempts + 1,
    emailLastTriedAt: at,
  };
}
