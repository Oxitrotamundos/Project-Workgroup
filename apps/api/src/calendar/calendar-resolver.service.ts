import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ResolvedWorkingDayPattern = {
  weekday: number;
  enabled: boolean;
  dayStart: Date | null;
  breakStart: Date | null;
  breakEnd: Date | null;
  dayEnd: Date | null;
};

export type ResolvedHoliday = {
  date: Date;
  label: string;
  recurringYearly: boolean;
};

export type ResolvedCalendar = {
  id: bigint;
  scope: 'global' | 'project';
  projectId: bigint | null;
  name: string;
  timezone: string;
  patterns: ResolvedWorkingDayPattern[];
  holidays: ResolvedHoliday[];
  hoursPerDay: number;
  createdAt: Date;
  updatedAt: Date;
};

type CacheEntry = { value: ResolvedCalendar; expiresAt: number };

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const GLOBAL_KEY = 'GLOBAL';

@Injectable()
export class CalendarResolverService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  invalidateAll(): void {
    this.cache.clear();
  }

  invalidateProject(projectId: bigint): void {
    this.cache.delete(projectId.toString());
  }

  hoursForWeekday(calendar: ResolvedCalendar, weekday: number): number {
    const pattern = calendar.patterns.find((p) => p.weekday === weekday);
    if (!pattern || !pattern.enabled || !pattern.dayStart || !pattern.dayEnd)
      return 0;
    const dayMs =
      this.timeToMs(pattern.dayEnd) - this.timeToMs(pattern.dayStart);
    const breakMs =
      pattern.breakStart && pattern.breakEnd
        ? this.timeToMs(pattern.breakEnd) - this.timeToMs(pattern.breakStart)
        : 0;
    return Math.max(0, (dayMs - breakMs) / 3_600_000);
  }

  effectiveHoursPerDay(calendar: ResolvedCalendar): number {
    let total = 0;
    let count = 0;
    for (const p of calendar.patterns) {
      const h = this.hoursForWeekday(calendar, p.weekday);
      if (h > 0) {
        total += h;
        count += 1;
      }
    }
    return count === 0 ? 0 : total / count;
  }

  isWorkingDay(calendar: ResolvedCalendar, date: Date): boolean {
    const weekday = date.getUTCDay();
    if (this.hoursForWeekday(calendar, weekday) <= 0) return false;
    return !this.isHoliday(calendar, date);
  }

  isHoliday(calendar: ResolvedCalendar, date: Date): boolean {
    for (const h of calendar.holidays) {
      const match = h.recurringYearly
        ? sameMonthDay(h.date, date)
        : sameYmd(h.date, date);
      if (match) return true;
    }
    return false;
  }

  async resolveForProject(
    projectId: bigint | null | undefined,
  ): Promise<ResolvedCalendar> {
    if (projectId === null || projectId === undefined) {
      return this.loadGlobal();
    }
    const cached = this.getCached(projectId.toString());
    if (cached) return cached;

    const projectCalendar = await this.prisma.workingCalendar.findUnique({
      where: { projectId },
      include: { patterns: { orderBy: { weekday: 'asc' } }, holidays: true },
    });
    if (projectCalendar) {
      const resolved = this.toResolved(projectCalendar);
      this.setCached(projectId.toString(), resolved);
      return resolved;
    }
    const global = await this.loadGlobal();

    this.setCached(projectId.toString(), global);
    return global;
  }

  async loadGlobal(): Promise<ResolvedCalendar> {
    const cached = this.getCached(GLOBAL_KEY);
    if (cached) return cached;

    const row = await this.prisma.workingCalendar.findFirst({
      where: { scope: 'global' },
      include: { patterns: { orderBy: { weekday: 'asc' } }, holidays: true },
    });
    if (!row) {
      throw new InternalServerErrorException(
        'GLOBAL working calendar is missing; run the seed migration before scheduling tasks',
      );
    }
    const resolved = this.toResolved(row);
    this.setCached(GLOBAL_KEY, resolved);
    return resolved;
  }

  async loadForProjectStrict(
    projectId: bigint,
  ): Promise<ResolvedCalendar | null> {
    const row = await this.prisma.workingCalendar.findUnique({
      where: { projectId },
      include: { patterns: { orderBy: { weekday: 'asc' } }, holidays: true },
    });
    if (!row) return null;
    return this.toResolved(row);
  }

  private toResolved(row: {
    id: bigint;
    scope: 'global' | 'project';
    projectId: bigint | null;
    name: string;
    timezone: string;
    patterns: ResolvedWorkingDayPattern[];
    holidays: ResolvedHoliday[];
    createdAt: Date;
    updatedAt: Date;
  }): ResolvedCalendar {
    const calendar: ResolvedCalendar = {
      id: row.id,
      scope: row.scope,
      projectId: row.projectId,
      name: row.name,
      timezone: row.timezone,
      patterns: row.patterns,
      holidays: row.holidays,
      hoursPerDay: 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    calendar.hoursPerDay = this.effectiveHoursPerDay(calendar);
    return calendar;
  }

  timeToMs(d: Date): number {
    return (
      d.getUTCHours() * 3_600_000 +
      d.getUTCMinutes() * 60_000 +
      d.getUTCSeconds() * 1000
    );
  }

  private getCached(key: string): ResolvedCalendar | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private setCached(key: string, value: ResolvedCalendar): void {
    if (!this.cache.has(key) && this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }
}

function sameMonthDay(a: Date, b: Date): boolean {
  return (
    a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
  );
}

function sameYmd(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && sameMonthDay(a, b);
}
