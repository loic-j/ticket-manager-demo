import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus, type ICommandHandler } from '@nestjs/cqrs';
import { TicketNotFoundError } from '../../domain/ticket-not-found.error.js';
import { TICKET_REPOSITORY, type TicketRepository } from '../../domain/ticket.repository.js';
import { updateTicket } from '../../domain/ticket.js';
import { UpdateTicketCommand } from './update-ticket.command.js';

@CommandHandler(UpdateTicketCommand)
export class UpdateTicketHandler implements ICommandHandler<UpdateTicketCommand, void> {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute({ ticketId, dto, actor }: UpdateTicketCommand): Promise<void> {
    const current = await this.tickets.findById(ticketId);
    if (!current) {
      throw new TicketNotFoundError(ticketId);
    }
    const { ticket, events } = updateTicket(current, dto, actor);
    if (events.length === 0) {
      return; // nothing changed: no write, no event
    }
    await this.tickets.save(ticket);
    await this.eventBus.publishAll(events);
  }
}
