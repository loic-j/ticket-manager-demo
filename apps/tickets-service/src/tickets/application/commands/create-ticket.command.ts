import type { CreateTicketDto } from '@ticketmanager/contracts';
import type { ActorId } from '../../domain/ticket.js';

export class CreateTicketCommand {
  constructor(
    readonly dto: CreateTicketDto,
    readonly actor: ActorId,
  ) {}
}
