import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  providers: [IdempotencyInterceptor, IdempotencyCleanupService],
  exports: [IdempotencyInterceptor],
})
export class IdempotencyModule {}
