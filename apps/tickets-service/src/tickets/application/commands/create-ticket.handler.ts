import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  OUTBOX,
  UNIT_OF_WORK,
  type Outbox,
  type UnitOfWork,
} from '../../../messaging/ports/index.js';
import { TICKET_REPOSITORY, type TicketRepository } from '../../domain/ticket.repository.js';
import { createTicket } from '../../domain/ticket.js';
import { toIntegrationEvents } from '../events/ticket-integration-events.js';
import { CreateTicketCommand } from './create-ticket.command.js';

/** @returns the id of the new ticket; the API reads it back through the query side. */
@CommandHandler(CreateTicketCommand)
export class CreateTicketHandler implements ICommandHandler<CreateTicketCommand, string> {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(OUTBOX) private readonly outbox: Outbox,
  ) {}

  async execute({ dto, actor }: CreateTicketCommand): Promise<string> {
    const { ticket, events } = createTicket(dto, actor);
    // Aggregate and outbox rows commit together; the relay publishes to the broker afterwards.
    await this.unitOfWork.run(async () => {
      await this.tickets.insert(ticket);
      await this.outbox.append(toIntegrationEvents(events, actor));
    });
    return ticket.id;
  }
}
