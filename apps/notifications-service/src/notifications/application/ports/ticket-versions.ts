export const TICKET_VERSIONS = Symbol('TICKET_VERSIONS');

/**
 * Staleness guard for ticket events. `advance` must run inside the unit of work of the event's
 * side effects: it records `version` for the ticket and reports whether it is newer than
 * everything seen so far. Older (or equal) versions are stale and must be ignored.
 */
export interface TicketVersions {
  advance(ticketId: string, version: number): Promise<boolean>;
}
