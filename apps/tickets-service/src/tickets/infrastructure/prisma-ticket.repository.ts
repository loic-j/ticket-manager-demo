import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { TicketRepository } from '../domain/ticket.repository.js';
import type { Ticket } from '../domain/ticket.js';
import { toTicket, toTicketRow } from './ticket-row.mapper.js';

/** PostgreSQL adapter for the write-side port, backed by Prisma. */
@Injectable()
export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Ticket | null> {
    const row = await this.prisma.ticket.findUnique({ where: { id } });
    return row ? toTicket(row) : null;
  }

  async save(ticket: Ticket): Promise<void> {
    const data = toTicketRow(ticket);
    await this.prisma.ticket.upsert({ where: { id: ticket.id }, create: data, update: data });
  }

  async delete(id: string): Promise<boolean> {
    const { count } = await this.prisma.ticket.deleteMany({ where: { id } });
    return count > 0;
  }
}
