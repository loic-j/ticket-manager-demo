import type { EmailDelivery, Notification } from './notification.js';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

/**
 * Write-side port. Updates are field-targeted so the email delivery job and the user's
 * "mark as read" never overwrite each other's columns.
 */
export interface NotificationRepository {
  findById(id: string): Promise<Notification | null>;
  insert(notification: Notification): Promise<void>;
  updateEmail(id: string, delivery: EmailDelivery): Promise<void>;
  /** No-op when already read. */
  markRead(id: string, at: Date): Promise<void>;
  /**
   * Reserves notifications whose email is not `sent`, tried fewer than `maxAttempts` times and
   * not tried since `notTriedSince` (or never), oldest first, by stamping `emailLastTriedAt`.
   * Concurrent workers never get the same rows (`FOR UPDATE SKIP LOCKED`), and a reserved row
   * is not offered again before the retry delay elapses.
   */
  claimEmailRetryCandidates(options: {
    maxAttempts: number;
    notTriedSince: Date;
    limit: number;
    now: Date;
  }): Promise<Notification[]>;
}
