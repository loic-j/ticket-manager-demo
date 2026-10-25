import type { Notification as NotificationView } from '@ticketmanager/contracts';
import type { Mail, Mailer } from '../application/ports/mailer.js';
import type { NotificationReadRepository } from '../application/ports/notification-read.repository.js';
import type { ProcessedEvents } from '../application/ports/processed-events.js';
import type { TicketVersions } from '../application/ports/ticket-versions.js';
import type { UnitOfWork } from '../application/ports/unit-of-work.js';
import type { UserDirectory, UserProfile } from '../application/ports/user-directory.js';
import type { NotificationRepository } from '../domain/notification.repository.js';
import type { EmailDelivery, Notification } from '../domain/notification.js';
import { toView } from './notification-row.mapper.js';

/** Test doubles for every port (no database, no broker, no SMTP). */

export class InMemoryNotificationRepository
  implements NotificationRepository, NotificationReadRepository
{
  readonly rows = new Map<string, Notification>();

  async findById(id: string): Promise<Notification | null> {
    return this.rows.get(id) ?? null;
  }

  async insert(notification: Notification): Promise<void> {
    if (this.rows.has(notification.id)) throw new Error(`duplicate id ${notification.id}`);
    this.rows.set(notification.id, notification);
  }

  async updateEmail(id: string, delivery: EmailDelivery): Promise<void> {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, ...delivery });
  }

  async markRead(id: string, at: Date): Promise<void> {
    const row = this.rows.get(id);
    if (row && !row.readAt) this.rows.set(id, { ...row, readAt: at.toISOString() });
  }

  async claimEmailRetryCandidates(options: {
    maxAttempts: number;
    notTriedSince: Date;
    limit: number;
    now: Date;
  }): Promise<Notification[]> {
    const since = options.notTriedSince.toISOString();
    const claimed = [...this.rows.values()]
      .filter(
        (n) =>
          n.email !== 'sent' &&
          n.emailAttempts < options.maxAttempts &&
          (!n.emailLastTriedAt || n.emailLastTriedAt < since) &&
          n.createdAt < since,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, options.limit)
      .map((n) => ({ ...n, emailLastTriedAt: options.now.toISOString() }));
    for (const n of claimed) this.rows.set(n.id, n);
    return claimed;
  }

  async listForUser(userId: string): Promise<NotificationView[]> {
    return [...this.rows.values()]
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toView);
  }
}

export class InMemoryProcessedEvents implements ProcessedEvents {
  readonly ids = new Set<string>();

  async claim(eventId: string): Promise<boolean> {
    if (this.ids.has(eventId)) return false;
    this.ids.add(eventId);
    return true;
  }
}

export class InMemoryTicketVersions implements TicketVersions {
  readonly versions = new Map<string, number>();

  async advance(ticketId: string, version: number): Promise<boolean> {
    if ((this.versions.get(ticketId) ?? 0) >= version) return false;
    this.versions.set(ticketId, version);
    return true;
  }
}

export class ImmediateUnitOfWork implements UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}

export class StaticUserDirectory implements UserDirectory {
  failWith?: Error;

  constructor(private readonly users: Record<string, UserProfile> = {}) {}

  async findById(userId: string): Promise<UserProfile | null> {
    if (this.failWith) throw this.failWith;
    return this.users[userId] ?? null;
  }
}

export class CapturingMailer implements Mailer {
  readonly sent: Mail[] = [];
  failWith?: Error;

  async send(mail: Mail): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.sent.push(mail);
  }
}
