import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TICKETS_API_RESOURCE } from '@ticketmanager/contracts';
import { AuthModule } from '@ticketmanager/nest-common';
import { createLoggerModule } from '@ticketmanager/telemetry';
import { CachingModule } from './caching/caching.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { TicketsModule } from './tickets/tickets.module.js';

@Module({
  imports: [
    // Loads apps/tickets-service/.env into process.env (no-op when the variables already come
    // from the environment, e.g. in Docker).
    ConfigModule.forRoot({ isGlobal: true }),
    createLoggerModule(),
    DatabaseModule,
    CachingModule,
    MessagingModule,
    AuthModule.forRoot({ defaultAudience: TICKETS_API_RESOURCE }),
    HealthModule,
    TicketsModule,
  ],
})
export class AppModule {}
