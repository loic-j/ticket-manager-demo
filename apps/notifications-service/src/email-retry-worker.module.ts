import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createLoggerModule } from '@ticketmanager/telemetry';
import { DatabaseModule } from './database/database.module.js';
import { EmailRetryModule } from './notifications/email-retry.module.js';

/** Root module of the email retry process: no HTTP, no broker consumer. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    createLoggerModule(),
    DatabaseModule,
    EmailRetryModule,
  ],
})
export class EmailRetryWorkerModule {}
