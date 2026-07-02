import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OAuthCleanupService {
  constructor(private readonly prisma: PrismaService) {}

  // Poda los payloads OAuth ya expirados (tokens/códigos/sesiones/interacciones caducados).
  @Cron(CronExpression.EVERY_HOUR)
  async prune(): Promise<number> {
    const res = await this.prisma.oAuthPayload.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return res.count;
  }
}
