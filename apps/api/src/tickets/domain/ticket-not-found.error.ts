export class TicketNotFoundError extends Error {
  constructor(readonly ticketId: string) {
    super(`Ticket ${ticketId} not found`);
    this.name = 'TicketNotFoundError';
  }
}
