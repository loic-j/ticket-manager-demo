import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';

@Controller('health')
export class HealthController {
  /** Liveness probe, reachable without a token. */
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }
}
