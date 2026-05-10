import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('tasks_update_total')
    private readonly tasksUpdateTotal: Counter<string>,
    @InjectMetric('tasks_update_duration_seconds')
    private readonly tasksUpdateDuration: Histogram<string>,
    @InjectMetric('tasks_conflict_total')
    private readonly tasksConflictTotal: Counter<string>,
  ) {}

  recordUpdate(
    operation: string,
    status: 'ok' | 'error',
    durationMs: number,
  ): void {
    this.tasksUpdateTotal.inc({ operation, status });
    this.tasksUpdateDuration.observe({ operation }, durationMs / 1000);
  }

  recordConflict(operation: string): void {
    this.tasksConflictTotal.inc({ operation });
  }
}
