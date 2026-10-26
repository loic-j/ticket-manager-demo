import { Injectable } from '@nestjs/common';
import { currentTraceId } from '@ticketmanager/telemetry';
import { PrismaService } from '../../database/infrastructure/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Outbox, OutboxEvent } from '../application/ports/outbox.js';

/**
 * Writes outbox rows through the ambient transaction (`PrismaService.db`). The envelope gets the
 * trace id of the request as `correlationId` when it has none, so the notification produced by an
 * event can be found from the trace that created the ticket (and the other way round).
 */
@Injectable()
export class PrismaOutbox implements Outbox {
  constructor(private readonly prisma: PrismaService) {}

  async append(events: OutboxEvent[]): Promise<void> {
    if (events.length === 0) return;
    const correlationId = currentTraceId();
    await this.prisma.db.outboxMessage.createMany({
      data: events.map(({ envelope: raw, aggregateType, aggregateId }) => {
        const envelope = { ...raw, correlationId: raw.correlationId ?? correlationId };
        return {
          id: envelope.id,
          type: envelope.type,
          version: envelope.version,
          aggregateType,
          aggregateId,
          // The whole envelope is stored so the relay can republish it verbatim.
          payload: envelope as unknown as Prisma.InputJsonValue,
          occurredAt: new Date(envelope.occurredAt),
        };
      }),
    });
  }
}
