/**
 * Migración de datos: recalcula endDate y workload de todas las tareas no-milestone
 * usando la nueva semántica de SchedulingService (endDate exclusivo con hora-del-día).
 *
 * Ejecutar:
 *   cd apps/api
 *   npx ts-node -P tsconfig.json prisma/reschedule-all-tasks.ts
 *
 * Idempotente: si las tareas ya tienen endDate "nueva", el resultado es el mismo.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import type {
  ResolvedCalendar,
  ResolvedHoliday,
  ResolvedWorkingDayPattern,
} from '../src/calendar/calendar-resolver.service';
import {
  SchedulingService,
  type ScheduledSlot,
} from '../src/calendar/scheduling.service';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type CalendarRow = Awaited<ReturnType<typeof loadCalendar>>;

async function loadCalendar(projectId: bigint | null): Promise<ResolvedCalendar | null> {
  const row = projectId
    ? await prisma.workingCalendar.findUnique({
        where: { projectId },
        include: { patterns: { orderBy: { weekday: 'asc' } }, holidays: true },
      })
    : await prisma.workingCalendar.findFirst({
        where: { scope: 'global' },
        include: { patterns: { orderBy: { weekday: 'asc' } }, holidays: true },
      });
  if (!row) return null;
  return toResolved(row);
}

function toResolved(row: {
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
  const cal: ResolvedCalendar = {
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
  cal.hoursPerDay = effectiveHoursPerDay(cal);
  return cal;
}

function effectiveHoursPerDay(cal: ResolvedCalendar): number {
  let total = 0;
  let count = 0;
  for (const p of cal.patterns) {
    if (!p.enabled || !p.dayStart || !p.dayEnd) continue;
    const dayMs = timeToMs(p.dayEnd) - timeToMs(p.dayStart);
    const breakMs =
      p.breakStart && p.breakEnd ? timeToMs(p.breakEnd) - timeToMs(p.breakStart) : 0;
    const h = Math.max(0, (dayMs - breakMs) / 3_600_000);
    if (h > 0) {
      total += h;
      count += 1;
    }
  }
  return count === 0 ? 0 : total / count;
}

function timeToMs(d: Date): number {
  return d.getUTCHours() * 3_600_000 + d.getUTCMinutes() * 60_000 + d.getUTCSeconds() * 1000;
}

// Resolver inline (sólo lo necesario para SchedulingService)
const resolverShim = {
  isWorkingDay(cal: ResolvedCalendar, date: Date): boolean {
    const weekday = date.getUTCDay();
    const pattern = cal.patterns.find((p) => p.weekday === weekday);
    if (!pattern || !pattern.enabled || !pattern.dayStart || !pattern.dayEnd) return false;
    for (const h of cal.holidays) {
      const recurring = h.recurringYearly;
      const match = recurring
        ? h.date.getUTCMonth() === date.getUTCMonth() && h.date.getUTCDate() === date.getUTCDate()
        : h.date.getUTCFullYear() === date.getUTCFullYear() &&
          h.date.getUTCMonth() === date.getUTCMonth() &&
          h.date.getUTCDate() === date.getUTCDate();
      if (match) return false;
    }
    return true;
  },
  hoursForWeekday(cal: ResolvedCalendar, weekday: number): number {
    const p = cal.patterns.find((x) => x.weekday === weekday);
    if (!p || !p.enabled || !p.dayStart || !p.dayEnd) return 0;
    const dayMs = timeToMs(p.dayEnd) - timeToMs(p.dayStart);
    const breakMs =
      p.breakStart && p.breakEnd ? timeToMs(p.breakEnd) - timeToMs(p.breakStart) : 0;
    return Math.max(0, (dayMs - breakMs) / 3_600_000);
  },
} as any;

const scheduling = new SchedulingService(resolverShim);

async function rescheduleProject(projectId: bigint, cal: CalendarRow): Promise<number> {
  if (!cal || !(cal.hoursPerDay > 0)) {
    console.warn(`  project ${projectId}: calendar without working hours, skipping`);
    return 0;
  }
  const tasks = await prisma.task.findMany({
    where: { projectId, type: { not: 'milestone' }, estimatedHours: { gt: 0 } },
    select: { id: true, startDate: true, estimatedHours: true, assigneeId: true },
  });
  if (!tasks.length) return 0;

  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const t of tasks) {
      const hours = Number(t.estimatedHours.toString());
      if (!Number.isFinite(hours) || hours <= 0) continue;
      let result: { startDate: Date; endDate: Date; workload: ScheduledSlot[] };
      try {
        result = scheduling.scheduleFromHours({
          estimatedHours: hours,
          startDateTime: t.startDate,
          calendar: cal,
        });
      } catch (err) {
        console.warn(`  task ${t.id}: scheduleFromHours failed (${(err as Error).message}); skipping`);
        continue;
      }
      await tx.task.update({
        where: { id: t.id },
        data: {
          startDate: result.startDate,
          endDate: result.endDate,
          duration: (hours / cal.hoursPerDay).toFixed(2),
          version: { increment: 1 },
        },
      });
      await tx.workload.deleteMany({ where: { taskId: t.id } });
      if (t.assigneeId && result.workload.length > 0) {
        await tx.workload.createMany({
          data: result.workload.map((slot) => ({
            userId: t.assigneeId!,
            taskId: t.id,
            projectId,
            date: slot.date,
            allocatedHours: slot.allocatedHours.toFixed(2),
          })),
          skipDuplicates: true,
        });
      }
      updated += 1;
    }
  });
  return updated;
}

async function main() {
  const global = await loadCalendar(null);
  const projects = await prisma.project.findMany({ select: { id: true, name: true } });
  let totalUpdated = 0;
  for (const p of projects) {
    const projectCal = await loadCalendar(p.id);
    const cal = projectCal ?? global;
    if (!cal) {
      console.warn(`project ${p.id} (${p.name}): no calendar resolvable; skipping`);
      continue;
    }
    const count = await rescheduleProject(p.id, cal);
    if (count > 0) console.log(`project ${p.name} (${p.id}): rescheduled ${count} tasks`);
    totalUpdated += count;
  }
  console.log(`Done. Total tasks rescheduled: ${totalUpdated}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
