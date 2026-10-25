export class ConcurrencyConflictError extends Error {
  constructor(readonly ticketId: string) {
    super(`Ticket ${ticketId} was modified concurrently, retry the operation`);
    this.name = 'ConcurrencyConflictError';
  }
}
