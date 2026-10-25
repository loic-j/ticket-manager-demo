export * from './handle-ticket-event.command.js';
export * from './handle-ticket-event.handler.js';
export * from './mark-notification-read.command.js';
export * from './mark-notification-read.handler.js';
export * from './retry-pending-emails.command.js';
export * from './retry-pending-emails.handler.js';
export * from './ticket-event-notifications.js';

import { HandleTicketEventHandler } from './handle-ticket-event.handler.js';
import { MarkNotificationReadHandler } from './mark-notification-read.handler.js';
import { RetryPendingEmailsHandler } from './retry-pending-emails.handler.js';

export const NOTIFICATION_COMMAND_HANDLERS = [
  HandleTicketEventHandler,
  MarkNotificationReadHandler,
  RetryPendingEmailsHandler,
] as const;
