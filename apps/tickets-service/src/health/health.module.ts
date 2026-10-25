import { Module } from '@nestjs/common';
import { HealthController } from './presentation/health.controller.js';

/** Liveness endpoint (`GET /health`, public). */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
