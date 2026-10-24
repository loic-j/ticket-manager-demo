import type { Notification as NotificationContract } from '@ticketmanager/contracts';

/** Domain model: the contract view plus the recipient and email delivery bookkeeping. */
export type Notification = NotificationContract & {
  userId: string;
  eventId: string;
  emailError: string | null;
  emailAttempts: number;
  emailLastTriedAt: string | null;
};

export type EmailDelivery = Pick<
  Notification,
  'email' | 'emailError' | 'emailAttempts' | 'emailLastTriedAt'
>;

export interface NewNotification {
  userId: string;
  kind: Notification['kind'];
  title: string;
  body: string;
  ticketId: string;
  eventId: string;
}

export function createNotification(input: NewNotification): Notification {
  return {
    id: crypto.randomUUID(),
    ...input,
    readAt: null,
    email: 'pending',
    emailError: null,
    emailAttempts: 0,
    emailLastTriedAt: null,
    createdAt: new Date().toISOString(),
  };
}

export function emailSent(notification: Notification, at = new Date()): EmailDelivery {
  return {
    email: 'sent',
    emailError: null,
    emailAttempts: notification.emailAttempts + 1,
    emailLastTriedAt: at.toISOString(),
  };
}

export function emailFailed(
  notification: Notification,
  error: string,
  at = new Date(),
): EmailDelivery {
  return {
    email: 'failed',
    emailError: error.slice(0, 1000),
    emailAttempts: notification.emailAttempts + 1,
    emailLastTriedAt: at.toISOString(),
  };
}
