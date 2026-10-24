import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health/health.controller.js';
import { TicketsModule } from './tickets/tickets.module.js';

@Module({
  imports: [AuthModule, TicketsModule],
  controllers: [HealthController],
})
export class AppModule {}
