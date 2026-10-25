import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { errors as joseErrors } from 'jose';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { JwtVerifier } from './jwt-verifier.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

const BEARER_PREFIX = 'Bearer ';

/**
 * Global guard: every route requires a valid Logto access token unless marked `@Public()`.
 * A token the verifier rejects is a 401. A verifier that cannot answer (JWKS fetch failed or
 * timed out, Logto down) is a 503: the caller's token may be perfectly valid, and reporting 401
 * would make `ServiceHttpClient` callers discard and re-request their machine tokens for nothing.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  private readonly logger = new Logger(AccessTokenGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtVerifier: JwtVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      req.user = await this.jwtVerifier.verify(header.slice(BEARER_PREFIX.length));
    } catch (error) {
      if (isVerifierUnavailable(error)) {
        this.logger.error(`Token verification unavailable: ${String(error)}`);
        throw new ServiceUnavailableException('Token verification unavailable');
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
    return true;
  }
}

/**
 * jose reports a token problem with a `JOSEError` (except `JWKSTimeout`, which is the key set
 * not answering); anything else (network error while fetching the JWKS, …) is an infrastructure
 * failure, not a bad token.
 */
function isVerifierUnavailable(error: unknown): boolean {
  if (error instanceof joseErrors.JWKSTimeout) return true;
  return !(error instanceof joseErrors.JOSEError) && error instanceof Error;
}
