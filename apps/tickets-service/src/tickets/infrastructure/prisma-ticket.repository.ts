import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { FindOptions, TicketRepository } from '../domain/ticket.repository.js';
import type { Ticket } from '../domain/ticket.js';
import { toTicket, toTicketRow } from './ticket-row.mapper.js';

/** PostgreSQL adapter for the write-side port, backed by Prisma. */
@Injectable()
export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, options: FindOptions = {}): Promise<Ticket | null> {
    if (options.forUpdate) {
      // Row lock held until the ambient transaction ends (no-op outside a unit of work).
      await this.prisma.db.$executeRaw`SELECT 1 FROM tickets WHERE id = ${id}::uuid FOR UPDATE`;
    }
    const row = await this.prisma.db.ticket.findUnique({ where: { id } });
    return row ? toTicket(row) : null;
  }

  async save(ticket: Ticket): Promise<void> {
    const data = toTicketRow(ticket);
    await this.prisma.db.ticket.upsert({ where: { id: ticket.id }, create: data, update: data });
  }

  async delete(id: string): Promise<boolean> {
    const { count } = await this.prisma.db.ticket.deleteMany({ where: { id } });
    return count > 0;
  }
}
