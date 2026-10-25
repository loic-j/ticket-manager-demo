import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { TicketVersions } from '../application/ports/ticket-versions.js';

/** One atomic statement: insert the version, or raise it only when the new one is greater. */
@Injectable()
export class PrismaTicketVersions implements TicketVersions {
  constructor(private readonly prisma: PrismaService) {}

  async advance(ticketId: string, version: number): Promise<boolean> {
    const rows = await this.prisma.db.$queryRaw<{ ticket_id: string }[]>`
      INSERT INTO ticket_versions (ticket_id, version, updated_at)
      VALUES (${ticketId}::uuid, ${version}, now())
      ON CONFLICT (ticket_id) DO UPDATE
        SET version = EXCLUDED.version, updated_at = now()
        WHERE ticket_versions.version < EXCLUDED.version
      RETURNING ticket_id`;
    return rows.length === 1;
  }
}
