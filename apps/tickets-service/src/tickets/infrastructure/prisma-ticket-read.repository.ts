import { Injectable } from '@nestjs/common';
import type { Ticket } from '@ticketmanager/contracts';
import { PrismaService } from '../../database/prisma.service.js';
import type { TicketReadRepository } from '../application/ports/ticket-read.repository.js';
import { toTicket } from './ticket-row.mapper.js';

/**
 * Read-side adapter. Today it reads the same table as the write side (CQRS-lite); a denormalised
 * projection can replace it without touching the query handlers.
 */
@Injectable()
export class PrismaTicketReadRepository implements TicketReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<Ticket[]> {
    const rows = await this.prisma.db.ticket.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(toTicket);
  }

  async getById(id: string): Promise<Ticket | null> {
    const row = await this.prisma.db.ticket.findUnique({ where: { id } });
    return row ? toTicket(row) : null;
  }
}
