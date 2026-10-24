export * from './create-ticket.command.js';
export * from './create-ticket.handler.js';
export * from './delete-ticket.command.js';
export * from './delete-ticket.handler.js';
export * from './update-ticket.command.js';
export * from './update-ticket.handler.js';

import { CreateTicketHandler } from './create-ticket.handler.js';
import { DeleteTicketHandler } from './delete-ticket.handler.js';
import { UpdateTicketHandler } from './update-ticket.handler.js';

export const TICKET_COMMAND_HANDLERS = [
  CreateTicketHandler,
  UpdateTicketHandler,
  DeleteTicketHandler,
] as const;
