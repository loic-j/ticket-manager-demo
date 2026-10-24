export * from './list-notifications.handler.js';
export * from './list-notifications.query.js';

import { ListNotificationsHandler } from './list-notifications.handler.js';

export const NOTIFICATION_QUERY_HANDLERS = [ListNotificationsHandler] as const;
