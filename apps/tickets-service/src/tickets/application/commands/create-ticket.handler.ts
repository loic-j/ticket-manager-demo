import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus, type ICommandHandler } from '@nestjs/cqrs';
import { TICKET_REPOSITORY, type TicketRepository } from '../../domain/ticket.repository.js';
import { createTicket } from '../../domain/ticket.js';
import { CreateTicketCommand } from './create-ticket.command.js';

/** @returns the id of the new ticket; the API reads it back through the query side. */
@CommandHandler(CreateTicketCommand)
export class CreateTicketHandler implements ICommandHandler<CreateTicketCommand, string> {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute({ dto, actor }: CreateTicketCommand): Promise<string> {
    const { ticket, events } = createTicket(dto, actor);
    await this.tickets.save(ticket);
    // Phase 2 (outbox) moves this publication into the same transaction as the save.
    await this.eventBus.publishAll(events);
    return ticket.id;
  }
}
