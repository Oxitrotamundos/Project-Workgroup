import { BadRequestException, Injectable } from '@nestjs/common';
import { CalendarResolverService, ResolvedCalendar } from './calendar-resolver.service';

export type ScheduledSlot = {
  date: Date;
  allocatedHours: number;
};

export type ScheduleResult = {
  startDate: Date;
  endDate: Date;
  workload: ScheduledSlot[];
};

// Tope defensivo: una task no puede agendarse más de 5 años desde su inicio.
// Si una jornada o calendario está mal configurado, esto evita un loop infinito.
const MAX_SCHEDULE_DAYS = 365 * 5;

@Injectable()
export class SchedulingService {
  constructor(private readonly resolver: CalendarResolverService) {}

  scheduleTask(input: {
    estimatedHours: number;
    startDate: Date;
    calendar: ResolvedCalendar;
  }): ScheduleResult {
    const { estimatedHours, calendar } = input;
    if (!Number.isFinite(estimatedHours) || estimatedHours <= 0) {
      throw new BadRequestException('estimatedHours must be a positive number');
    }

    let cursor = this.toUtcDateOnly(input.startDate);
    let dayCount = 0;
    while (!this.resolver.isWorkingDay(calendar, cursor)) {
      cursor = this.addDays(cursor, 1);
      dayCount += 1;
      if (dayCount > MAX_SCHEDULE_DAYS) {
        throw new BadRequestException(
          'unable to find a working day within 5 years of startDate; check calendar configuration',
        );
      }
    }

    const startDate = cursor;
    let remaining = estimatedHours;
    let endDate = startDate;
    const workload: ScheduledSlot[] = [];

    while (remaining > 0) {
      if (this.resolver.isWorkingDay(calendar, cursor)) {
        const capacity = this.resolver.hoursForWeekday(calendar, cursor.getUTCDay());
        if (capacity > 0) {
          const allocated = roundToHundredths(Math.min(remaining, capacity));
          workload.push({ date: new Date(cursor), allocatedHours: allocated });
          remaining = roundToHundredths(remaining - allocated);
          endDate = cursor;
        }
      }
      if (remaining > 0) {
        cursor = this.addDays(cursor, 1);
        dayCount += 1;
        if (dayCount > MAX_SCHEDULE_DAYS) {
          throw new BadRequestException(
            'task exceeds 5 years of scheduling horizon; verify estimatedHours and calendar capacity',
          );
        }
      }
    }

    return { startDate, endDate, workload };
  }

  /** Cuenta cuántos días laborables hay entre start y end (ambos inclusive). */
  workingDaysBetween(calendar: ResolvedCalendar, start: Date, end: Date): number {
    const s = this.toUtcDateOnly(start);
    const e = this.toUtcDateOnly(end);
    if (e.getTime() < s.getTime()) return 0;
    let count = 0;
    let cursor = s;
    while (cursor.getTime() <= e.getTime()) {
      if (this.resolver.isWorkingDay(calendar, cursor)) count += 1;
      cursor = this.addDays(cursor, 1);
    }
    return count;
  }

  toUtcDateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  addDays(d: Date, n: number): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
  }
}

function roundToHundredths(n: number): number {
  return Math.round(n * 100) / 100;
}
