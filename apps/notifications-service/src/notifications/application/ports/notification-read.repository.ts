import type { Notification } from '@ticketmanager/contracts';

export const NOTIFICATION_READ_REPOSITORY = Symbol('NOTIFICATION_READ_REPOSITORY');

/** Read-side port: API views for one recipient, newest first. */
export interface NotificationReadRepository {
  listForUser(userId: string): Promise<Notification[]>;
}
