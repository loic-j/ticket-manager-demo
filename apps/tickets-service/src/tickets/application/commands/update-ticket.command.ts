import type { UpdateTicketDto } from '@ticketmanager/contracts';
import type { ActorId } from '../../domain/ticket.js';

export class UpdateTicketCommand {
  constructor(
    readonly ticketId: string,
    readonly dto: UpdateTicketDto,
    readonly actor: ActorId,
  ) {}
}
