import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  OUTBOX,
  UNIT_OF_WORK,
  type Outbox,
  type UnitOfWork,
} from '../../../messaging/ports/index.js';
import { TicketNotFoundError } from '../../domain/ticket-not-found.error.js';
import { TICKET_REPOSITORY, type TicketRepository } from '../../domain/ticket.repository.js';
import { updateTicket } from '../../domain/ticket.js';
import { toIntegrationEvents } from '../events/ticket-integration-events.js';
import { UpdateTicketCommand } from './update-ticket.command.js';

@CommandHandler(UpdateTicketCommand)
export class UpdateTicketHandler implements ICommandHandler<UpdateTicketCommand, void> {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(OUTBOX) private readonly outbox: Outbox,
  ) {}

  execute({ ticketId, dto, actor }: UpdateTicketCommand): Promise<void> {
    // Read-modify-write under a row lock so concurrent updates serialise instead of losing one.
    return this.unitOfWork.run(async () => {
      const current = await this.tickets.findById(ticketId, { forUpdate: true });
      if (!current) {
        throw new TicketNotFoundError(ticketId);
      }
      const { ticket, events } = updateTicket(current, dto, actor);
      if (events.length === 0) {
        return; // nothing changed: no write, no event
      }
      await this.tickets.save(ticket);
      await this.outbox.append(toIntegrationEvents(events, actor));
    });
  }
}
