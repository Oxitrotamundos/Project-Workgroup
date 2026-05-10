import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service';

const RETENTION_HOURS = 24;

@Injectable()
export class IdempotencyCleanupService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @InjectPinoLogger(IdempotencyCleanupService.name) private readonly logger?: PinoLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.purge();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async purge(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000);
    const { count } = await this.prisma.idempotencyKey.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count > 0) {
      this.logger?.info({ removed: count, cutoff: cutoff.toISOString() }, 'idempotency keys purged');
    }
  }
}
