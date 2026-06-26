import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  ImportProjectDto,
  ImportProjectResponse,
  ImportTaskDto,
  ProjectResponse,
} from '@project-workgroup/shared';
import { CalendarResolverService } from '../calendar/calendar-resolver.service';
import { SchedulingService } from '../calendar/scheduling.service';
import { SummaryRecalculationService } from '../tasks/summary-recalculation.service';
import { statusToPrisma, priorityToPrisma } from '../tasks/wire';
import { firstOrder, after } from '../tasks/fractional-index';
import {
  toPrisma as projectStatusToPrisma,
  toWire as projectStatusToWire,
} from './status.mapper';
import { wouldCreateCycle, Edge } from '../task-links/cycle-detector';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class ProjectImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarResolver: CalendarResolverService,
    private readonly scheduling: SchedulingService,
    private readonly summaries: SummaryRecalculationService,
  ) {}

  // Orden padre-antes-que-hijo + validación de refs únicas, padres existentes y sin ciclos.
  // Público para testearlo de forma aislada sin tocar la BD.
  topoSortTasks(tasks: ImportTaskDto[]): ImportTaskDto[] {
    const byRef = new Map<string, ImportTaskDto>();
    for (const t of tasks) {
      if (byRef.has(t.ref)) {
        throw new BadRequestException(`duplicate task ref "${t.ref}"`);
      }
      byRef.set(t.ref, t);
    }
    for (const t of tasks) {
      if (t.parentRef !== undefined && !byRef.has(t.parentRef)) {
        throw new BadRequestException(
          `task "${t.ref}" references unknown parentRef "${t.parentRef}"`,
        );
      }
    }

    const sorted: ImportTaskDto[] = [];
    const placed = new Set<string>();
    const inProgress = new Set<string>();

    const visit = (task: ImportTaskDto): void => {
      if (placed.has(task.ref)) return;
      if (inProgress.has(task.ref)) {
        throw new BadRequestException(
          `parent cycle detected at task "${task.ref}"`,
        );
      }
      inProgress.add(task.ref);
      if (task.parentRef !== undefined) {
        visit(byRef.get(task.parentRef)!);
      }
      inProgress.delete(task.ref);
      placed.add(task.ref);
      sorted.push(task);
    };

    for (const t of tasks) visit(t);
    return sorted;
  }

  private computeSchedule(
    task: ImportTaskDto,
    hoursPerDay: number,
    calendar: Parameters<SchedulingService['scheduleFromRange']>[0]['calendar'],
  ): {
    startDate: Date;
    endDate: Date;
    duration: string;
    estimatedHours?: string;
  } {
    const start = new Date(task.startDate);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException(`task "${task.ref}" has an invalid startDate`);
    }

    if (task.type === 'milestone') {
      return { startDate: start, endDate: start, duration: '0' };
    }

    if (task.endDate !== undefined) {
      const end = new Date(task.endDate);
      if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
        throw new BadRequestException(
          `task "${task.ref}" endDate must be greater than startDate`,
        );
      }
      const r = this.scheduling.scheduleFromRange({
        startDateTime: start,
        endDateTime: end,
        calendar,
      });
      return {
        startDate: r.startDate,
        endDate: r.endDate,
        duration:
          hoursPerDay > 0 ? (r.estimatedHours / hoursPerDay).toFixed(2) : '0',
        estimatedHours: r.estimatedHours.toFixed(2),
      };
    }

    const hours =
      task.estimatedHours !== undefined && Number(task.estimatedHours) > 0
        ? Number(task.estimatedHours)
        : hoursPerDay > 0
          ? hoursPerDay
          : 8;
    const r = this.scheduling.scheduleFromHours({
      estimatedHours: hours,
      startDateTime: start,
      calendar,
    });
    return {
      startDate: r.startDate,
      endDate: r.endDate,
      duration: (hours / (hoursPerDay > 0 ? hoursPerDay : 8)).toFixed(2),
      estimatedHours: hours.toFixed(2),
    };
  }

  async import(
    dto: ImportProjectDto,
    ownerId: bigint,
  ): Promise<ImportProjectResponse> {
    // Validación pura (refs/jerarquía/ciclos) antes de abrir transacción.
    const ordered = this.topoSortTasks(dto.tasks);

    const result = await this.prisma.$transaction(
      async (tx: TxClient) => {
        const project = await tx.project.create({
          data: {
            name: dto.project.name,
            description: dto.project.description ?? null,
            startDate: new Date(dto.project.startDate),
            endDate: new Date(dto.project.endDate),
            status: projectStatusToPrisma(dto.project.status),
            ownerId,
            color: dto.project.color,
          },
        });

        const calendar = await this.calendarResolver.resolveForProject(
          project.id,
        );
        const hoursPerDay = calendar.hoursPerDay || 8;

        const refToId = new Map<string, bigint>();
        let order = firstOrder();
        for (const task of ordered) {
          const schedule = this.computeSchedule(task, hoursPerDay, calendar);
          const parentId =
            task.parentRef !== undefined ? refToId.get(task.parentRef)! : null;
          const created = await tx.task.create({
            data: {
              projectId: project.id,
              parentId,
              name: task.name,
              description: task.description ?? null,
              startDate: schedule.startDate,
              endDate: schedule.endDate,
              duration: schedule.duration,
              ...(schedule.estimatedHours !== undefined && {
                estimatedHours: new Prisma.Decimal(schedule.estimatedHours),
              }),
              priority: priorityToPrisma(task.priority),
              status: statusToPrisma(task.status),
              type: task.type as any,
              color: task.color,
              tags: task.tags ?? [],
              order,
            },
            select: { id: true },
          });
          refToId.set(task.ref, created.id);
          order = after(order);
        }

        const deps = dto.dependencies ?? [];
        const edges: Edge[] = [];
        for (const dep of deps) {
          const sourceId = refToId.get(dep.fromRef);
          const targetId = refToId.get(dep.toRef);
          if (sourceId === undefined || targetId === undefined) {
            throw new BadRequestException(
              `dependency references unknown ref(s): ${dep.fromRef} -> ${dep.toRef}`,
            );
          }
          if (sourceId === targetId) {
            throw new BadRequestException(
              `dependency fromRef and toRef must differ ("${dep.fromRef}")`,
            );
          }
          if (wouldCreateCycle(edges, sourceId.toString(), targetId.toString())) {
            throw new BadRequestException(
              `dependency ${dep.fromRef} -> ${dep.toRef} would create a cycle`,
            );
          }
          await tx.taskLink.create({
            data: {
              projectId: project.id,
              sourceTaskId: sourceId,
              targetTaskId: targetId,
              type: dep.type as any,
            },
          });
          edges.push({
            sourceTaskId: sourceId.toString(),
            targetTaskId: targetId.toString(),
          });
        }

        await this.summaries.recalculate(project.id, tx);

        const fresh = await tx.project.findUnique({
          where: { id: project.id },
        });
        return { project: fresh!, refToId };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 30000,
      },
    );

    return {
      project: this.toProjectResponse(result.project),
      taskRefToId: Object.fromEntries(
        Array.from(result.refToId.entries()).map(([ref, id]) => [
          ref,
          id.toString(),
        ]),
      ),
      taskCount: ordered.length,
      dependencyCount: (dto.dependencies ?? []).length,
    };
  }

  private toProjectResponse(p: {
    id: bigint;
    name: string;
    description: string | null;
    startDate: Date;
    endDate: Date;
    status: string;
    ownerId: bigint;
    color: string;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectResponse {
    return {
      id: p.id.toString(),
      name: p.name,
      description: p.description,
      startDate: p.startDate.toISOString().slice(0, 10),
      endDate: p.endDate.toISOString().slice(0, 10),
      status: projectStatusToWire(p.status as any),
      ownerId: p.ownerId.toString(),
      color: p.color,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
