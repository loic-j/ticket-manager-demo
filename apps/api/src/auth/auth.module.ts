import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessTokenGuard } from './access-token.guard.js';
import { AUTH_CONFIG, loadAuthConfig } from './auth.config.js';
import { JwtVerifier } from './jwt-verifier.js';

@Module({
  providers: [
    { provide: AUTH_CONFIG, useFactory: () => loadAuthConfig() },
    JwtVerifier,
    { provide: APP_GUARD, useClass: AccessTokenGuard },
  ],
  exports: [AUTH_CONFIG, JwtVerifier],
})
export class AuthModule {}
