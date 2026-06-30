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
import { TaskScheduleCalculator } from '../calendar/task-schedule-calculator.service';
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
    private readonly scheduleCalculator: TaskScheduleCalculator,
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

  // Amplía el rango del proyecto para cubrir las tareas; nunca lo encoge.
  expandProjectBounds(
    projectStart: Date,
    projectEnd: Date,
    ranges: { startDate: Date; endDate: Date }[],
  ): { startDate: Date; endDate: Date } {
    let startDate = projectStart;
    let endDate = projectEnd;
    for (const r of ranges) {
      if (r.startDate.getTime() < startDate.getTime()) startDate = r.startDate;
      if (r.endDate.getTime() > endDate.getTime()) endDate = r.endDate;
    }
    return { startDate, endDate };
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

        const refToId = new Map<string, bigint>();
        const taskRanges: { startDate: Date; endDate: Date }[] = [];
        let order = firstOrder();
        for (const task of ordered) {
          const schedule = this.scheduleCalculator.calculate(
            calendar,
            task.type,
            new Date(task.startDate),
            task.endDate !== undefined ? new Date(task.endDate) : undefined,
            task.estimatedHours,
          );
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
          taskRanges.push({
            startDate: schedule.startDate,
            endDate: schedule.endDate,
          });
          order = after(order);
        }

        const bounds = this.expandProjectBounds(
          project.startDate,
          project.endDate,
          taskRanges,
        );
        if (
          bounds.startDate.getTime() !== project.startDate.getTime() ||
          bounds.endDate.getTime() !== project.endDate.getTime()
        ) {
          await tx.project.update({
            where: { id: project.id },
            data: { startDate: bounds.startDate, endDate: bounds.endDate },
          });
        }

        const deps = dto.dependencies ?? [];
        const edges: Edge[] = [];
        // Refleja el @@unique([sourceTaskId, targetTaskId, type]) de task_links.
        const seenDeps = new Set<string>();
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
          const depKey = `${sourceId}|${targetId}|${dep.type}`;
          if (seenDeps.has(depKey)) {
            throw new BadRequestException(
              `duplicate dependency ${dep.fromRef} -> ${dep.toRef} (${dep.type})`,
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
          seenDeps.add(depKey);
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
