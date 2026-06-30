import { BadRequestException, Injectable } from '@nestjs/common';
import { SchedulingService, ScheduledSlot } from './scheduling.service';
import { ResolvedCalendar } from './calendar-resolver.service';

export type ComputedSchedule = {
  startDate: Date;
  endDate: Date;
  duration: string;
  estimatedHours?: string;
  hoursPerDay: number;
  workload: ScheduledSlot[];
};

@Injectable()
export class TaskScheduleCalculator {
  constructor(private readonly scheduling: SchedulingService) {}

  private parseEstimatedHours(raw: string | undefined): number | undefined {
    if (raw === undefined || raw === null || raw === '') return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      throw new BadRequestException(
        'estimatedHours must be a non-negative number',
      );
    }
    return n;
  }

  // Única fuente de verdad del scheduling de tareas. El calendario llega ya resuelto
  // para que el caller (creación o importación) controle cuántas veces lo resuelve.
  calculate(
    calendar: ResolvedCalendar,
    type: string,
    rawStart: Date,
    rawEnd?: Date,
    estimatedHoursRaw?: string,
  ): ComputedSchedule {
    const hoursPerDay = calendar.hoursPerDay || 8;
    const estimatedHours = this.parseEstimatedHours(estimatedHoursRaw);

    if (type === 'milestone') {
      return {
        startDate: rawStart,
        endDate: rawStart,
        duration: '0',
        estimatedHours:
          estimatedHours !== undefined ? estimatedHours.toFixed(2) : undefined,
        hoursPerDay,
        workload: [],
      };
    }

    if (rawEnd !== undefined) {
      if (rawEnd.getTime() <= rawStart.getTime()) {
        throw new BadRequestException('endDate must be greater than startDate');
      }
      const result = this.scheduling.scheduleFromRange({
        startDateTime: rawStart,
        endDateTime: rawEnd,
        calendar,
      });
      return {
        startDate: result.startDate,
        endDate: result.endDate,
        duration:
          hoursPerDay > 0
            ? (result.estimatedHours / hoursPerDay).toFixed(2)
            : '0',
        estimatedHours: result.estimatedHours.toFixed(2),
        hoursPerDay,
        workload: result.workload,
      };
    }

    if (estimatedHours !== undefined && estimatedHours > 0) {
      const result = this.scheduling.scheduleFromHours({
        estimatedHours,
        startDateTime: rawStart,
        calendar,
      });
      return {
        startDate: result.startDate,
        endDate: result.endDate,
        duration: (estimatedHours / hoursPerDay).toFixed(2),
        estimatedHours: estimatedHours.toFixed(2),
        hoursPerDay,
        workload: result.workload,
      };
    }

    const defaultHours = hoursPerDay > 0 ? hoursPerDay : 8;
    const result = this.scheduling.scheduleFromHours({
      estimatedHours: defaultHours,
      startDateTime: rawStart,
      calendar,
    });
    return {
      startDate: result.startDate,
      endDate: result.endDate,
      duration: '1.00',
      estimatedHours: defaultHours.toFixed(2),
      hoursPerDay,
      workload: result.workload,
    };
  }
}
