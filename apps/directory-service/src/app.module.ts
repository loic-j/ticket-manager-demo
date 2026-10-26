import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DIRECTORY_API_RESOURCE } from '@ticketmanager/contracts';
import { AuthModule } from '@ticketmanager/nest-common';
import { createLoggerModule } from '@ticketmanager/telemetry';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    createLoggerModule(),
    AuthModule.forRoot({ defaultAudience: DIRECTORY_API_RESOURCE }),
    HealthModule,
    UsersModule,
  ],
})
export class AppModule {}
