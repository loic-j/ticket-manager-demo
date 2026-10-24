import { Injectable } from '@nestjs/common';
import type { Notification as NotificationView } from '@ticketmanager/contracts';
import { PrismaService } from '../../database/prisma.service.js';
import type { NotificationReadRepository } from '../application/ports/notification-read.repository.js';
import type { NotificationRepository } from '../domain/notification.repository.js';
import type { EmailDelivery, Notification } from '../domain/notification.js';
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

  async findEmailRetryCandidates(options: {
    maxAttempts: number;
    notTriedSince: Date;
    limit: number;
  }): Promise<Notification[]> {
    const rows = await this.prisma.db.notification.findMany({
      where: {
        email: { not: 'sent' },
        emailAttempts: { lt: options.maxAttempts },
        OR: [{ emailLastTriedAt: null }, { emailLastTriedAt: { lt: options.notTriedSince } }],
        createdAt: { lt: options.notTriedSince },
      },
      orderBy: { createdAt: 'asc' },
      take: options.limit,
    });
    return rows.map(toNotification);
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
