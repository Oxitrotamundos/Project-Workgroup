import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarResolverService, ResolvedCalendar } from './calendar-resolver.service';
import { TaskReschedulerService } from './task-rescheduler.service';
import {
  HolidayDto,
  UpsertCalendarDto,
  WorkingCalendarResponse,
  WorkingDayPatternDto,
  WorkingDayPatternResponse,
} from '@project-workgroup/shared';

const DEFAULT_GLOBAL_TIMEZONE = 'America/Lima';
const DEFAULT_GLOBAL_NAME = 'Estándar (L-V, 8h con pausa de comida)';

@Injectable()
export class CalendarService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: CalendarResolverService,
    private readonly rescheduler: TaskReschedulerService,
    @Optional() @InjectPinoLogger(CalendarService.name) private readonly logger?: PinoLogger,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const exists = await this.prisma.workingCalendar.findFirst({ where: { scope: 'global' } });
    if (exists) return;
    this.logger?.warn('GLOBAL working calendar missing; creating default');
    await this.createDefaultGlobal();
  }

  async getGlobal(): Promise<WorkingCalendarResponse> {
    const resolved = await this.resolver.loadGlobal();
    return this.toResponse(resolved);
  }

  async getForProject(projectId: bigint): Promise<WorkingCalendarResponse> {
    const override = await this.resolver.loadForProjectStrict(projectId);
    if (override) return this.toResponse(override);
    const global = await this.resolver.loadGlobal();
    return this.toResponse(global);
  }

  async upsertGlobal(dto: UpsertCalendarDto): Promise<WorkingCalendarResponse> {
    this.assertValidTimezone(dto.timezone);
    this.validatePatterns(dto.patterns);
    const existing = await this.prisma.workingCalendar.findFirst({ where: { scope: 'global' } });

    const result = await this.prisma.$transaction(async (tx) => {
      const calendar = existing
        ? await tx.workingCalendar.update({
            where: { id: existing.id },
            data: {
              name: dto.name ?? existing.name,
              timezone: dto.timezone,
            },
          })
        : await tx.workingCalendar.create({
            data: {
              scope: 'global',
              projectId: null,
              name: dto.name ?? DEFAULT_GLOBAL_NAME,
              timezone: dto.timezone,
            },
          });

      await tx.workingDayPattern.deleteMany({ where: { calendarId: calendar.id } });
      await tx.workingDayPattern.createMany({
        data: dto.patterns.map((p) => this.patternToRow(calendar.id, p)),
      });

      await tx.holiday.deleteMany({ where: { calendarId: calendar.id } });
      if (dto.holidays?.length) {
        await tx.holiday.createMany({
          data: dto.holidays.map((h) => this.holidayToRow(calendar.id, h)),
        });
      }
      return calendar.id;
    });

    this.resolver.invalidateAll();
    await this.rescheduler.rescheduleAllInheriting();
    return this.toResponse(await this.resolver.loadGlobal());
  }

  async upsertForProject(projectId: bigint, dto: UpsertCalendarDto): Promise<WorkingCalendarResponse> {
    this.assertValidTimezone(dto.timezone);
    this.validatePatterns(dto.patterns);
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException('project not found');

    const existing = await this.prisma.workingCalendar.findUnique({ where: { projectId } });
    await this.prisma.$transaction(async (tx) => {
      const calendar = existing
        ? await tx.workingCalendar.update({
            where: { id: existing.id },
            data: {
              name: dto.name ?? existing.name,
              timezone: dto.timezone,
            },
          })
        : await tx.workingCalendar.create({
            data: {
              scope: 'project',
              projectId,
              name: dto.name ?? `Calendario del proyecto ${projectId}`,
              timezone: dto.timezone,
            },
          });

      await tx.workingDayPattern.deleteMany({ where: { calendarId: calendar.id } });
      await tx.workingDayPattern.createMany({
        data: dto.patterns.map((p) => this.patternToRow(calendar.id, p)),
      });

      await tx.holiday.deleteMany({ where: { calendarId: calendar.id } });
      if (dto.holidays?.length) {
        await tx.holiday.createMany({
          data: dto.holidays.map((h) => this.holidayToRow(calendar.id, h)),
        });
      }
    });

    this.resolver.invalidateProject(projectId);
    await this.rescheduler.rescheduleProject(projectId);
    const resolved = (await this.resolver.loadForProjectStrict(projectId))!;
    return this.toResponse(resolved);
  }

  async deleteProjectOverride(projectId: bigint): Promise<void> {
    const existing = await this.prisma.workingCalendar.findUnique({ where: { projectId } });
    if (!existing) {
      throw new NotFoundException('project does not have a calendar override');
    }
    await this.prisma.workingCalendar.delete({ where: { id: existing.id } });
    this.resolver.invalidateProject(projectId);
    await this.rescheduler.rescheduleProject(projectId);
  }

  private async createDefaultGlobal(): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const cal = await tx.workingCalendar.create({
          data: {
            scope: 'global',
            projectId: null,
            name: DEFAULT_GLOBAL_NAME,
            timezone: DEFAULT_GLOBAL_TIMEZONE,
          },
        });
        await tx.workingDayPattern.createMany({
          data: [
            { calendarId: cal.id, weekday: 0, enabled: false, dayStart: null, breakStart: null, breakEnd: null, dayEnd: null },
            ...[1, 2, 3, 4, 5].map((w) => ({
              calendarId: cal.id,
              weekday: w,
              enabled: true,
              dayStart: timeOf('09:00:00'),
              breakStart: timeOf('13:00:00'),
              breakEnd: timeOf('14:00:00'),
              dayEnd: timeOf('18:00:00'),
            })),
            { calendarId: cal.id, weekday: 6, enabled: false, dayStart: null, breakStart: null, breakEnd: null, dayEnd: null },
          ],
        });
      });
    } catch (err) {
      const isUnique =
        err instanceof Error &&
        typeof (err as { code?: string }).code === 'string' &&
        (err as { code?: string }).code === 'P2002';
      if (!isUnique) throw err;
    }
  }

  private patternToRow(calendarId: bigint, p: WorkingDayPatternDto) {
    return {
      calendarId,
      weekday: p.weekday,
      enabled: p.enabled,
      dayStart: p.enabled ? timeOf(p.dayStart) : null,
      breakStart: p.enabled && p.breakStart ? timeOf(p.breakStart) : null,
      breakEnd: p.enabled && p.breakEnd ? timeOf(p.breakEnd) : null,
      dayEnd: p.enabled ? timeOf(p.dayEnd) : null,
    };
  }

  private holidayToRow(calendarId: bigint, h: HolidayDto) {
    return {
      calendarId,
      date: new Date(h.date.length >= 10 ? `${h.date.slice(0, 10)}T00:00:00Z` : h.date),
      label: h.label,
      recurringYearly: h.recurringYearly ?? false,
    };
  }

  private assertValidTimezone(tz: string): void {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
    } catch {
      throw new BadRequestException(`timezone "${tz}" is not a valid IANA timezone`);
    }
  }

  private validatePatterns(patterns: WorkingDayPatternDto[]): void {
    const seen = new Set<number>();
    for (const p of patterns) {
      if (seen.has(p.weekday)) {
        throw new BadRequestException(`duplicate pattern for weekday ${p.weekday}`);
      }
      seen.add(p.weekday);
      if (!p.enabled) continue;
      if (!p.dayStart || !p.dayEnd) {
        throw new BadRequestException(`enabled weekday ${p.weekday} requires dayStart and dayEnd`);
      }
      const ds = timeToMinutes(p.dayStart);
      const de = timeToMinutes(p.dayEnd);
      if (de <= ds) {
        throw new BadRequestException(`weekday ${p.weekday}: dayEnd must be after dayStart`);
      }
      if ((p.breakStart && !p.breakEnd) || (!p.breakStart && p.breakEnd)) {
        throw new BadRequestException(`weekday ${p.weekday}: breakStart and breakEnd must come together`);
      }
      if (p.breakStart && p.breakEnd) {
        const bs = timeToMinutes(p.breakStart);
        const be = timeToMinutes(p.breakEnd);
        if (bs < ds || be > de || be <= bs) {
          throw new BadRequestException(`weekday ${p.weekday}: break must fit within the day range`);
        }
      }
    }
  }

  private toResponse(calendar: ResolvedCalendar): WorkingCalendarResponse {
    const patternsByDay = new Map<number, WorkingDayPatternResponse>();
    for (const p of calendar.patterns) {
      patternsByDay.set(p.weekday, {
        weekday: p.weekday,
        enabled: p.enabled,
        dayStart: p.dayStart ? formatTime(p.dayStart) : null,
        breakStart: p.breakStart ? formatTime(p.breakStart) : null,
        breakEnd: p.breakEnd ? formatTime(p.breakEnd) : null,
        dayEnd: p.dayEnd ? formatTime(p.dayEnd) : null,
      });
    }
    const orderedPatterns: WorkingDayPatternResponse[] = [];
    for (let w = 0; w < 7; w += 1) {
      const p = patternsByDay.get(w);
      if (p) orderedPatterns.push(p);
      else orderedPatterns.push({ weekday: w, enabled: false, dayStart: null, breakStart: null, breakEnd: null, dayEnd: null });
    }
    return {
      id: calendar.id.toString(),
      scope: calendar.scope,
      projectId: calendar.projectId?.toString() ?? null,
      name: calendar.name,
      timezone: calendar.timezone,
      patterns: orderedPatterns,
      holidays: calendar.holidays.map((h) => ({
        date: h.date.toISOString().slice(0, 10),
        label: h.label,
        recurringYearly: h.recurringYearly,
      })),
      hoursPerDay: calendar.hoursPerDay.toFixed(2),
      createdAt: calendar.createdAt.toISOString(),
      updatedAt: calendar.updatedAt.toISOString(),
    };
  }
}

function timeOf(value: string | null | undefined): Date {
  const normalized = value && value.length === 5 ? `${value}:00` : value ?? '00:00:00';
  return new Date(`1970-01-01T${normalized}Z`);
}

function timeToMinutes(value: string): number {
  const [hh, mm] = value.split(':');
  return Number(hh) * 60 + Number(mm);
}

function formatTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
