import { Controller, Get } from '@nestjs/common';
import { Public } from '@ticketmanager/nest-common';

@Controller('health')
export class HealthController {
  /** Liveness probe, reachable without a token. */
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }
}
