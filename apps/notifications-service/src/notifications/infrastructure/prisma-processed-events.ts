import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/infrastructure/prisma.service.js';
import type { ProcessedEvents } from '../application/ports/processed-events.js';

/** Primary-key based inbox; the insert fails inside the ambient transaction on a duplicate. */
@Injectable()
export class PrismaProcessedEvents implements ProcessedEvents {
  constructor(private readonly prisma: PrismaService) {}

  async claim(eventId: string, type: string): Promise<boolean> {
    const { count } = await this.prisma.db.processedEvent.createMany({
      data: [{ eventId, type }],
      skipDuplicates: true,
    });
    return count === 1;
  }
}
