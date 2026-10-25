import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/infrastructure/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { TicketRepository } from '../domain/ticket.repository.js';
import type { Ticket } from '../domain/ticket.js';
import { toTicket, toTicketRow, toTicketUpdate } from './ticket-row.mapper.js';

/** Prisma error code: the record an update/delete targeted does not exist. */
const RECORD_NOT_FOUND = 'P2025';

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
      data: toTicketUpdate(ticket),
    });
    return count === 1;
  }

  /** One statement: `DELETE ... RETURNING`, so two concurrent deletes cannot both succeed. */
  async delete(id: string): Promise<Ticket | null> {
    try {
      return toTicket(await this.prisma.db.ticket.delete({ where: { id } }));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === RECORD_NOT_FOUND
      ) {
        return null;
      }
      throw error;
    }
  }
}
