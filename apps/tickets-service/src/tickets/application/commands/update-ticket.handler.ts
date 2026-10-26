import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  OUTBOX,
  UNIT_OF_WORK,
  type Outbox,
  type UnitOfWork,
} from '../../../messaging/application/ports/index.js';
import { ConcurrencyConflictError } from '../../domain/concurrency-conflict.error.js';
import { TicketNotFoundError } from '../../domain/ticket-not-found.error.js';
import { TICKET_REPOSITORY, type TicketRepository } from '../../domain/ticket.repository.js';
import { updateTicket } from '../../domain/ticket.js';
import { toTicketPatch } from '../mappers/ticket.mapper.js';
import { TICKET_CACHE, type TicketCache } from '../ports/ticket-cache.js';
import { toIntegrationEvents } from '../events/ticket-integration-events.js';
import { UpdateTicketCommand } from './update-ticket.command.js';

const MAX_ATTEMPTS = 3;

/**
 * Optimistic read-modify-write: the update only applies if nobody changed the ticket since it
 * was read; on a conflict the command is replayed on the fresh state a few times, then rejected.
 * A client-supplied `expectedVersion` is stricter: the ticket must still be at that version,
 * otherwise the command is rejected immediately (the client edited a stale copy).
 */
@CommandHandler(UpdateTicketCommand)
export class UpdateTicketHandler implements ICommandHandler<UpdateTicketCommand, void> {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(OUTBOX) private readonly outbox: Outbox,
    @Inject(TICKET_CACHE) private readonly cache: TicketCache,
  ) {}

  async execute(command: UpdateTicketCommand): Promise<void> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (await this.tryOnce(command)) {
        return;
      }
    }
    throw new ConcurrencyConflictError(command.ticketId);
  }

  /** @returns `false` on a version conflict (caller retries). */
  private async tryOnce({
    ticketId,
    dto,
    actor,
    expectedVersion,
  }: UpdateTicketCommand): Promise<boolean> {
    const current = await this.tickets.findById(ticketId);
    if (!current) {
      throw new TicketNotFoundError(ticketId);
    }
    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      throw new ConcurrencyConflictError(ticketId); // stale client copy: retrying cannot help
    }
    const { ticket, events } = updateTicket(current, toTicketPatch(dto), actor);
    if (events.length === 0) {
      return true; // nothing changed: no write, no event
    }
    const applied = await this.unitOfWork.run(async () => {
      if (!(await this.tickets.update(ticket))) {
        return false; // the unit of work has nothing to commit
      }
      await this.outbox.append(toIntegrationEvents(events, actor));
      return true;
    });
    if (applied) {
      await this.cache.evict(ticketId); // after commit, never inside the transaction
    }
    return applied;
  }
}
