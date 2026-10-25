import type { UpdateTicketDto } from '@ticketmanager/contracts';
import type { ActorId } from '../../domain/ticket.js';

export class UpdateTicketCommand {
  constructor(
    readonly ticketId: string,
    readonly dto: UpdateTicketDto,
    readonly actor: ActorId,
    /**
     * Version the client edited from (`expectedVersion` of the PATCH body). When set, a stored
     * version that differs is a conflict right away: the client must reload before retrying.
     */
    readonly expectedVersion?: number,
  ) {}
}
