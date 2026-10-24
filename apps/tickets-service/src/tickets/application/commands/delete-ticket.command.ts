import type { ActorId } from '../../domain/ticket.js';

export class DeleteTicketCommand {
  constructor(
    readonly ticketId: string,
    readonly actor: ActorId,
  ) {}
}
