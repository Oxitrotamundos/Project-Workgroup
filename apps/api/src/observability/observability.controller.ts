import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import { PrismaHealthIndicator } from './prisma-health.indicator';

@ApiTags('observability')
@Controller({ version: VERSION_NEUTRAL })
export class ObservabilityController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
  ) {}

  @Get('health')
  @HealthCheck()
  check() {
    return this.health.check([() => this.prismaHealth.ping('database')]);
  }
}
