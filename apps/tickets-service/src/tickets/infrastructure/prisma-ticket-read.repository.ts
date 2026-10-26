import { Injectable } from '@nestjs/common';
import type { Ticket as TicketView } from '@ticketmanager/contracts';
import { PrismaService } from '../../database/infrastructure/prisma.service.js';
import { toTicketView } from '../application/mappers/ticket.mapper.js';
import type { TicketReadRepository } from '../application/ports/ticket-read.repository.js';
import { toTicket } from './ticket-row.mapper.js';

/**
 * Read-side adapter. Today it reads the same table as the write side (CQRS-lite); a denormalised
 * projection can replace it without touching the query handlers.
 */
@Injectable()
export class PrismaTicketReadRepository implements TicketReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<TicketView[]> {
    const rows = await this.prisma.db.ticket.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((row) => toTicketView(toTicket(row)));
  }

  async getById(id: string): Promise<TicketView | null> {
    const row = await this.prisma.db.ticket.findUnique({ where: { id } });
    return row ? toTicketView(toTicket(row)) : null;
  }
}
