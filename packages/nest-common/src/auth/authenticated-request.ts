import type { AuthUser } from '@ticketmanager/contracts';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
