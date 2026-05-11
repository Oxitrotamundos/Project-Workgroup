import { Injectable, Optional } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CalendarResolverService } from './calendar-resolver.service';
import { SchedulingService } from './scheduling.service';

export type RescheduleSummary = {
  projects: number;
  tasksRescheduled: number;
};

@Injectable()
export class TaskReschedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: CalendarResolverService,
    private readonly scheduling: SchedulingService,
    @Optional() @InjectPinoLogger(TaskReschedulerService.name) private readonly logger?: PinoLogger,
  ) {}

  async rescheduleProject(projectId: bigint): Promise<number> {
    this.resolver.invalidate(projectId);
    const calendar = await this.resolver.resolveForProject(projectId);
    if (!(calendar.hoursPerDay > 0)) {
      this.logger?.warn({ projectId: projectId.toString() }, 'calendar has zero working hours; skipping reschedule');
      return 0;
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        estimatedHours: { gt: 0 },
        type: { not: 'milestone' },
      },
      select: {
        id: true,
        startDate: true,
        estimatedHours: true,
        assigneeId: true,
      },
    });

    let rescheduled = 0;
    for (const t of tasks) {
      const hours = Number(t.estimatedHours.toString());
      if (!Number.isFinite(hours) || hours <= 0) continue;

      const result = this.scheduling.scheduleTask({
        estimatedHours: hours,
        startDate: t.startDate,
        calendar,
      });

      const durationDays = hours / calendar.hoursPerDay;

      await this.prisma.$transaction(async (tx) => {
        await tx.task.update({
          where: { id: t.id },
          data: {
            startDate: result.startDate,
            endDate: result.endDate,
            duration: new Prisma.Decimal(durationDays.toFixed(2)),
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
              allocatedHours: new Prisma.Decimal(slot.allocatedHours.toFixed(2)),
            })),
            skipDuplicates: true,
          });
        }
      });
      rescheduled += 1;
    }

    this.logger?.info(
      { projectId: projectId.toString(), rescheduled, totalCandidates: tasks.length },
      'project tasks rescheduled',
    );
    return rescheduled;
  }

  async rescheduleAllInheriting(): Promise<RescheduleSummary> {
    const projects = await this.prisma.project.findMany({
      where: { calendar: { is: null } },
      select: { id: true },
    });
    let tasks = 0;
    for (const p of projects) {
      tasks += await this.rescheduleProject(p.id);
    }
    this.logger?.info(
      { projects: projects.length, tasksRescheduled: tasks },
      'global calendar reschedule complete',
    );
    return { projects: projects.length, tasksRescheduled: tasks };
  }
}
