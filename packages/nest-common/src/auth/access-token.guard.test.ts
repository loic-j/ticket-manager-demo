import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { errors as joseErrors } from 'jose';
import { describe, expect, it } from 'vitest';
import { AccessTokenGuard } from './access-token.guard.js';
import type { JwtVerifier } from './jwt-verifier.js';

function context(authorization?: string): ExecutionContext {
  const req = { headers: { authorization } };
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function guard(verify: JwtVerifier['verify']): AccessTokenGuard {
  return new AccessTokenGuard(new Reflector(), { verify } as JwtVerifier);
}

describe('AccessTokenGuard', () => {
  it('rejects a missing bearer with 401', async () => {
    await expect(guard(async () => ({ sub: 'u' })).canActivate(context())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('maps a token the verifier rejects to 401', async () => {
    const g = guard(async () => {
      throw new joseErrors.JWTExpired('expired', {});
    });
    await expect(g.canActivate(context('Bearer t'))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('maps an unavailable key set to 503, not 401', async () => {
    const timeout = guard(async () => {
      throw new joseErrors.JWKSTimeout();
    });
    await expect(timeout.canActivate(context('Bearer t'))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    const network = guard(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(network.canActivate(context('Bearer t'))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('attaches the verified user to the request', async () => {
    const ctx = context('Bearer t');
    await expect(guard(async () => ({ sub: 'user_1' })).canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest<{ user?: { sub: string } }>().user).toEqual({
      sub: 'user_1',
    });
  });
});
