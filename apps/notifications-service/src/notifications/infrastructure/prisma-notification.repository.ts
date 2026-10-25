import { Injectable } from '@nestjs/common';
import type { Notification as NotificationView } from '@ticketmanager/contracts';
import { PrismaService } from '../../database/infrastructure/prisma.service.js';
import type { NotificationReadRepository } from '../application/ports/notification-read.repository.js';
import type { NotificationRepository } from '../domain/notification.repository.js';
import type { EmailDelivery, Notification } from '../domain/notification.js';
import type { Notification as NotificationRow } from '../../generated/prisma/client.js';
import { toNotification, toRow, toView } from './notification-row.mapper.js';

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Notification | null> {
    const row = await this.prisma.db.notification.findUnique({ where: { id } });
    return row ? toNotification(row) : null;
  }

  async insert(notification: Notification): Promise<void> {
    await this.prisma.db.notification.create({ data: toRow(notification) });
  }

  async updateEmail(id: string, delivery: EmailDelivery): Promise<void> {
    await this.prisma.db.notification.updateMany({
      where: { id },
      data: {
        email: delivery.email,
        emailError: delivery.emailError,
        emailAttempts: delivery.emailAttempts,
        emailLastTriedAt: delivery.emailLastTriedAt ? new Date(delivery.emailLastTriedAt) : null,
      },
    });
  }

  async markRead(id: string, at: Date): Promise<void> {
    await this.prisma.db.notification.updateMany({
      where: { id, readAt: null },
      data: { readAt: at },
    });
  }

  async claimEmailRetryCandidates(options: {
    maxAttempts: number;
    notTriedSince: Date;
    limit: number;
    now: Date;
  }): Promise<Notification[]> {
    // Claim-then-process: the stamp keeps other workers (and the next tick) away from these rows;
    // `FOR UPDATE SKIP LOCKED` makes concurrent claims pick disjoint rows instead of waiting.
    const rows = await this.prisma.db.$queryRaw<RawRow[]>`
      UPDATE notifications SET email_last_tried_at = ${options.now}
      WHERE id IN (
        SELECT id FROM notifications
        WHERE email <> 'sent' AND email_attempts < ${options.maxAttempts}
          AND created_at < ${options.notTriedSince}
          AND (email_last_tried_at IS NULL OR email_last_tried_at < ${options.notTriedSince})
        ORDER BY created_at
        LIMIT ${options.limit}
        FOR UPDATE SKIP LOCKED)
      RETURNING id, user_id, kind, title, body, ticket_id, event_id, read_at, email, email_error,
        email_attempts, email_last_tried_at, created_at`;
    return rows.map((r) => toNotification(fromRaw(r)));
  }
}

@Injectable()
export class PrismaNotificationReadRepository implements NotificationReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<NotificationView[]> {
    const rows = await this.prisma.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => toView(toNotification(row)));
  }
}

/** Snake-case row returned by raw SQL. */
type RawRow = {
  id: string;
  user_id: string;
  kind: NotificationRow['kind'];
  title: string;
  body: string;
  ticket_id: string;
  event_id: string;
  read_at: Date | null;
  email: NotificationRow['email'];
  email_error: string | null;
  email_attempts: number;
  email_last_tried_at: Date | null;
  created_at: Date;
};

function fromRaw(r: RawRow): NotificationRow {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    ticketId: r.ticket_id,
    eventId: r.event_id,
    readAt: r.read_at,
    email: r.email,
    emailError: r.email_error,
    emailAttempts: r.email_attempts,
    emailLastTriedAt: r.email_last_tried_at,
    createdAt: r.created_at,
  };
}
