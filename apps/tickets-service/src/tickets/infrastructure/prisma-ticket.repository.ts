import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { TicketRepository } from '../domain/ticket.repository.js';
import type { Ticket } from '../domain/ticket.js';
import { toTicket, toTicketRow } from './ticket-row.mapper.js';

/** PostgreSQL adapter for the write-side port, backed by Prisma (optimistic concurrency). */
@Injectable()
export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Ticket | null> {
    const row = await this.prisma.db.ticket.findUnique({ where: { id } });
    return row ? toTicket(row) : null;
  }

  async insert(ticket: Ticket): Promise<void> {
    await this.prisma.db.ticket.create({ data: toTicketRow(ticket) });
  }

  async update(ticket: Ticket): Promise<boolean> {
    const { count } = await this.prisma.db.ticket.updateMany({
      where: { id: ticket.id, version: ticket.version - 1 },
      data: toTicketRow(ticket),
    });
    return count === 1;
  }

  async delete(id: string): Promise<Ticket | null> {
    const row = await this.prisma.db.ticket.findUnique({ where: { id } });
    if (!row) return null;
    const { count } = await this.prisma.db.ticket.deleteMany({
      where: { id, version: row.version },
    });
    return count === 1 ? toTicket(row) : null;
  }
}
