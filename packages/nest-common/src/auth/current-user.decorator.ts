import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@ticketmanager/contracts';
import type { AuthenticatedRequest } from './authenticated-request.js';

/** Injects the `AuthUser` attached by `AccessTokenGuard`. Only valid on guarded routes. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const { user } = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) {
      throw new Error('@CurrentUser() used on a route without AccessTokenGuard');
    }
    return user;
  },
);
