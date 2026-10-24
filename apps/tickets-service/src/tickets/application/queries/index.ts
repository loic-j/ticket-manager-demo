export * from './get-ticket.handler.js';
export * from './get-ticket.query.js';
export * from './list-tickets.handler.js';
export * from './list-tickets.query.js';

import { GetTicketHandler } from './get-ticket.handler.js';
import { ListTicketsHandler } from './list-tickets.handler.js';

export const TICKET_QUERY_HANDLERS = [ListTicketsHandler, GetTicketHandler] as const;
