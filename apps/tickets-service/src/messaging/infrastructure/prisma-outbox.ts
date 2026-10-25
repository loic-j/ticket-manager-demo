import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/infrastructure/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Outbox, OutboxEvent } from '../application/ports/outbox.js';

/** Writes outbox rows through the ambient transaction (`PrismaService.db`). */
@Injectable()
export class PrismaOutbox implements Outbox {
  constructor(private readonly prisma: PrismaService) {}

  async append(events: OutboxEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.prisma.db.outboxMessage.createMany({
      data: events.map(({ envelope, aggregateType, aggregateId }) => ({
        id: envelope.id,
        type: envelope.type,
        version: envelope.version,
        aggregateType,
        aggregateId,
        // The whole envelope is stored so the relay can republish it verbatim.
        payload: envelope as unknown as Prisma.InputJsonValue,
        occurredAt: new Date(envelope.occurredAt),
      })),
    });
  }
}
