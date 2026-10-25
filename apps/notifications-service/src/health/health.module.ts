import { Module } from '@nestjs/common';
import { HealthController } from './presentation/health.controller.js';

/** Liveness probe (`GET /health`), public. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
