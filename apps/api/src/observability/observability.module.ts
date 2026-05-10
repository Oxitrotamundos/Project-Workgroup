import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { PrismaModule } from '../prisma/prisma.module';
import { ObservabilityController } from './observability.controller';
import { PrismaHealthIndicator } from './prisma-health.indicator';
import { MetricsService } from './metrics.service';

@Module({
  imports: [
    TerminusModule,
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      defaultLabels: { app: 'project-workgroup-api' },
    }),
    PrismaModule,
  ],
  controllers: [ObservabilityController],
  providers: [
    PrismaHealthIndicator,
    MetricsService,
    makeCounterProvider({
      name: 'tasks_update_total',
      help: 'Total task write operations',
      labelNames: ['operation', 'status'],
    }),
    makeHistogramProvider({
      name: 'tasks_update_duration_seconds',
      help: 'Task write operation duration in seconds',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),
    makeCounterProvider({
      name: 'tasks_conflict_total',
      help: 'Total optimistic-locking conflicts',
      labelNames: ['operation'],
    }),
  ],
  exports: [MetricsService],
})
export class ObservabilityModule {}
