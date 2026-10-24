import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { TicketsModule } from './tickets/tickets.module.js';

@Module({
  imports: [
    // Loads apps/api/.env into process.env (no-op when the variables already come from the
    // environment, e.g. in Docker).
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    TicketsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
