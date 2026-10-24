import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Ticket as TicketRow } from '../../generated/prisma/client.js';
import type { TicketRepository } from '../domain/ticket.repository.js';
import type { Ticket } from '../domain/ticket.js';

/** PostgreSQL adapter for the tickets port, backed by Prisma. */
@Injectable()
export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Ticket[]> {
    const rows = await this.prisma.ticket.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Ticket | null> {
    const row = await this.prisma.ticket.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async save(ticket: Ticket): Promise<void> {
    const data = toRow(ticket);
    await this.prisma.ticket.upsert({ where: { id: ticket.id }, create: data, update: data });
  }

  async delete(id: string): Promise<boolean> {
    const { count } = await this.prisma.ticket.deleteMany({ where: { id } });
    return count > 0;
  }
}

function toDomain(row: TicketRow): Ticket {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRow(ticket: Ticket): TicketRow {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    createdBy: ticket.createdBy,
    updatedBy: ticket.updatedBy,
    createdAt: new Date(ticket.createdAt),
    updatedAt: new Date(ticket.updatedAt),
  };
}
