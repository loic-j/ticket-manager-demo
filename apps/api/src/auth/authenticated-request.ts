import type { AuthUser } from '@ticketmanager/shared';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
