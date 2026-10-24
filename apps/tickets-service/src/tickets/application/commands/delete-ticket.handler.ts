import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus, type ICommandHandler } from '@nestjs/cqrs';
import { TicketDeletedEvent } from '../../domain/events/ticket-events.js';
import { TicketNotFoundError } from '../../domain/ticket-not-found.error.js';
import { TICKET_REPOSITORY, type TicketRepository } from '../../domain/ticket.repository.js';
import { DeleteTicketCommand } from './delete-ticket.command.js';

@CommandHandler(DeleteTicketCommand)
export class DeleteTicketHandler implements ICommandHandler<DeleteTicketCommand, void> {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute({ ticketId, actor }: DeleteTicketCommand): Promise<void> {
    if (!(await this.tickets.delete(ticketId))) {
      throw new TicketNotFoundError(ticketId);
    }
    await this.eventBus.publish(new TicketDeletedEvent(ticketId, actor));
  }
}
