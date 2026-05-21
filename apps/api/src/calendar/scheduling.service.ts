import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CalendarResolverService,
  ResolvedCalendar,
} from './calendar-resolver.service';

export type ScheduledSlot = {
  date: Date;
  allocatedHours: number;
};

export type ScheduleResult = {
  startDate: Date;
  endDate: Date;
  workload: ScheduledSlot[];
};

export type RangeScheduleResult = ScheduleResult & { estimatedHours: number };

export type WorkSlot = { start: Date; end: Date };

const MAX_SCHEDULE_DAYS = 365 * 5;
const MS_PER_HOUR = 3_600_000;

@Injectable()
export class SchedulingService {
  constructor(private readonly resolver: CalendarResolverService) {}

  workSlotsForDay(calendar: ResolvedCalendar, date: Date): WorkSlot[] {
    if (!this.resolver.isWorkingDay(calendar, date)) return [];
    const pattern = calendar.patterns.find(
      (p) => p.weekday === date.getUTCDay(),
    );
    if (!pattern || !pattern.enabled || !pattern.dayStart || !pattern.dayEnd)
      return [];

    const dayStart = this.absoluteTime(date, pattern.dayStart);
    const dayEnd = this.absoluteTime(date, pattern.dayEnd);
    if (dayEnd.getTime() <= dayStart.getTime()) return [];

    if (pattern.breakStart && pattern.breakEnd) {
      const breakStart = this.absoluteTime(date, pattern.breakStart);
      const breakEnd = this.absoluteTime(date, pattern.breakEnd);
      const slots: WorkSlot[] = [];
      if (dayStart.getTime() < breakStart.getTime()) {
        slots.push({ start: dayStart, end: this.minDate(breakStart, dayEnd) });
      }
      if (breakEnd.getTime() < dayEnd.getTime()) {
        slots.push({ start: this.maxDate(breakEnd, dayStart), end: dayEnd });
      }
      return slots;
    }
    return [{ start: dayStart, end: dayEnd }];
  }

  hoursAvailableOnDay(
    calendar: ResolvedCalendar,
    date: Date,
    lower?: Date,
    upper?: Date,
  ): number {
    const slots = this.workSlotsForDay(calendar, date);
    if (slots.length === 0) return 0;
    let totalMs = 0;
    for (const slot of slots) {
      const start =
        lower && lower.getTime() > slot.start.getTime() ? lower : slot.start;
      const end =
        upper && upper.getTime() < slot.end.getTime() ? upper : slot.end;
      if (end.getTime() > start.getTime())
        totalMs += end.getTime() - start.getTime();
    }
    return totalMs / MS_PER_HOUR;
  }

  workingHoursInRange(
    calendar: ResolvedCalendar,
    start: Date,
    end: Date,
  ): number {
    if (end.getTime() <= start.getTime()) return 0;
    let cursor = this.toUtcDateOnly(start);
    const last = this.toUtcDateOnly(end);
    let dayCount = 0;
    let total = 0;
    while (cursor.getTime() <= last.getTime()) {
      total += this.hoursAvailableOnDay(calendar, cursor, start, end);
      cursor = this.addDays(cursor, 1);
      dayCount += 1;
      if (dayCount > MAX_SCHEDULE_DAYS) {
        throw new BadRequestException(
          'range exceeds 5 years; refusing to compute',
        );
      }
    }
    return roundToHundredths(total);
  }

  scheduleFromHours(input: {
    estimatedHours: number;
    startDateTime: Date;
    calendar: ResolvedCalendar;
  }): ScheduleResult {
    const { estimatedHours, calendar, startDateTime } = input;
    if (!Number.isFinite(estimatedHours) || estimatedHours <= 0) {
      throw new BadRequestException('estimatedHours must be a positive number');
    }

    let cursor = this.toUtcDateOnly(startDateTime);
    let dayCount = 0;
    let remainingMs = Math.round(estimatedHours * MS_PER_HOUR);
    let firstWorkInstant: Date | null = null;
    let endDate: Date = startDateTime;
    const workload: ScheduledSlot[] = [];

    while (remainingMs > 0) {
      const slots = this.workSlotsForDay(calendar, cursor);
      let dayAllocatedMs = 0;

      for (const slot of slots) {
        if (remainingMs <= 0) break;
        let slotStart = slot.start;
        if (firstWorkInstant === null) {
          if (startDateTime.getTime() >= slot.end.getTime()) continue;
          if (startDateTime.getTime() > slot.start.getTime())
            slotStart = startDateTime;
        }
        const capMs = slot.end.getTime() - slotStart.getTime();
        if (capMs <= 0) continue;

        if (firstWorkInstant === null) firstWorkInstant = slotStart;

        const takeMs = Math.min(remainingMs, capMs);
        const allocEnd = new Date(slotStart.getTime() + takeMs);
        endDate = allocEnd;
        dayAllocatedMs += takeMs;
        remainingMs -= takeMs;
      }

      if (dayAllocatedMs > 0) {
        workload.push({
          date: new Date(cursor),
          allocatedHours: roundToHundredths(dayAllocatedMs / MS_PER_HOUR),
        });
      }

      if (remainingMs > 0) {
        cursor = this.addDays(cursor, 1);
        dayCount += 1;
        if (dayCount > MAX_SCHEDULE_DAYS) {
          throw new BadRequestException(
            'task exceeds 5 years of scheduling horizon; verify estimatedHours and calendar capacity',
          );
        }
      }
    }

    if (firstWorkInstant === null) {
      throw new BadRequestException(
        'unable to allocate task within scheduling horizon',
      );
    }
    return { startDate: firstWorkInstant, endDate, workload };
  }

  scheduleFromRange(input: {
    startDateTime: Date;
    endDateTime: Date;
    calendar: ResolvedCalendar;
  }): RangeScheduleResult {
    const { startDateTime, endDateTime, calendar } = input;
    if (endDateTime.getTime() <= startDateTime.getTime()) {
      throw new BadRequestException('endDate must be greater than startDate');
    }
    let cursor = this.toUtcDateOnly(startDateTime);
    const last = this.toUtcDateOnly(endDateTime);
    let dayCount = 0;
    let total = 0;
    const workload: ScheduledSlot[] = [];
    while (cursor.getTime() <= last.getTime()) {
      const hours = this.hoursAvailableOnDay(
        calendar,
        cursor,
        startDateTime,
        endDateTime,
      );
      if (hours > 0) {
        workload.push({
          date: new Date(cursor),
          allocatedHours: roundToHundredths(hours),
        });
        total += hours;
      }
      cursor = this.addDays(cursor, 1);
      dayCount += 1;
      if (dayCount > MAX_SCHEDULE_DAYS) {
        throw new BadRequestException(
          'range exceeds 5 years; refusing to compute',
        );
      }
    }
    return {
      startDate: startDateTime,
      endDate: endDateTime,
      estimatedHours: roundToHundredths(total),
      workload,
    };
  }

  toUtcDateOnly(d: Date): Date {
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  addDays(d: Date, n: number): Date {
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n),
    );
  }

  private absoluteTime(date: Date, timeOnly: Date): Date {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        timeOnly.getUTCHours(),
        timeOnly.getUTCMinutes(),
        timeOnly.getUTCSeconds(),
      ),
    );
  }

  private minDate(a: Date, b: Date): Date {
    return a.getTime() <= b.getTime() ? a : b;
  }

  private maxDate(a: Date, b: Date): Date {
    return a.getTime() >= b.getTime() ? a : b;
  }
}

function roundToHundredths(n: number): number {
  return Math.round(n * 100) / 100;
}
