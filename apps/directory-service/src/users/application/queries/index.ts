export * from './get-user.handler.js';
export * from './get-user.query.js';
export * from './get-users.handler.js';
export * from './get-users.query.js';

import { GetUserHandler } from './get-user.handler.js';
import { GetUsersHandler } from './get-users.handler.js';

export const USER_QUERY_HANDLERS = [GetUserHandler, GetUsersHandler] as const;
