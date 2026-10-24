import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessTokenGuard } from './access-token.guard.js';
import { AUTH_CONFIG, loadAuthConfig, type AuthModuleOptions } from './auth.config.js';
import { JwtVerifier } from './jwt-verifier.js';

/** Registers the global access-token guard for a service. Import once in the root module. */
@Module({})
export class AuthModule {
  static forRoot(options: AuthModuleOptions): DynamicModule {
    return {
      module: AuthModule,
      providers: [
        { provide: AUTH_CONFIG, useFactory: () => loadAuthConfig(options) },
        JwtVerifier,
        { provide: APP_GUARD, useClass: AccessTokenGuard },
      ],
      exports: [AUTH_CONFIG, JwtVerifier],
    };
  }
}
