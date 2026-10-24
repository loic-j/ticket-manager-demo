import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  OUTBOX,
  UNIT_OF_WORK,
  type Outbox,
  type UnitOfWork,
} from '../../../messaging/ports/index.js';
import { TicketDeletedEvent } from '../../domain/events/ticket-events.js';
import { TicketNotFoundError } from '../../domain/ticket-not-found.error.js';
import { TICKET_REPOSITORY, type TicketRepository } from '../../domain/ticket.repository.js';
import { toIntegrationEvents } from '../events/ticket-integration-events.js';
import { DeleteTicketCommand } from './delete-ticket.command.js';

@CommandHandler(DeleteTicketCommand)
export class DeleteTicketHandler implements ICommandHandler<DeleteTicketCommand, void> {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(OUTBOX) private readonly outbox: Outbox,
  ) {}

  async execute({ ticketId, actor }: DeleteTicketCommand): Promise<void> {
    const event = new TicketDeletedEvent(ticketId, actor);
    await this.unitOfWork.run(async () => {
      if (!(await this.tickets.delete(ticketId))) {
        throw new TicketNotFoundError(ticketId);
      }
      await this.outbox.append(toIntegrationEvents([event], actor));
    });
  }
}
