import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { HealthService, HealthStatus } from './health.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  check(): Promise<HealthStatus> {
    return this.health.check();
  }
}
