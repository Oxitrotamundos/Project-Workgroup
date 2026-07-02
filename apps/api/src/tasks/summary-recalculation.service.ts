import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  SummaryPatch,
  computeSummaryBounds,
  SummaryBoundsNode,
} from '@project-workgroup/shared';

type DbClient = PrismaService | Prisma.TransactionClient;

type SummaryCalcRow = {
  id: bigint;
  parentId: bigint | null;
  startDate: Date;
  endDate: Date;
  duration: { toString(): string };
  progress: number;
  type: string;
  estimatedHours: { toString(): string };
};
type SummaryStats = {
  weightedProgress: number;
  progressWeight: number;
  fallbackProgress: number;
  fallbackCount: number;
  estimatedHours: number;
};

@Injectable()
export class SummaryRecalculationService {
  constructor(private readonly prisma: PrismaService) {}

  // NOTE: cuerpo movido sin cambios desde TasksService.recalculateProjectSummaries
  // (apps/api/src/tasks/tasks.service.ts:528-705). Renombrado el parámetro a `client`.
  async recalculate(
    projectId: bigint,
    client: DbClient = this.prisma,
  ): Promise<SummaryPatch[]> {
    const tasks = await client.task.findMany({
      where: { projectId },
      select: {
        id: true,
        parentId: true,
        startDate: true,
        endDate: true,
        duration: true,
        progress: true,
        type: true,
        estimatedHours: true,
      },
    });

    const childrenByParent = new Map<string, SummaryCalcRow[]>();
    for (const task of tasks) {
      if (task.parentId === null) continue;
      const key = task.parentId.toString();
      const list = childrenByParent.get(key);
      if (list) list.push(task);
      else childrenByParent.set(key, [task]);
    }

    // Fechas (start/end) de cada summary: regla compartida con el Gantt web (packages/shared).
    const boundsMap = computeSummaryBounds(
      tasks.map(
        (t): SummaryBoundsNode => ({
          id: t.id.toString(),
          parentId: t.parentId?.toString() ?? null,
          type: t.type,
          start: t.startDate?.getTime() ?? null,
          end: t.endDate?.getTime() ?? null,
        }),
      ),
    );

    const memo = new Map<string, SummaryStats>();

    // Progreso y horas agregados del subárbol (las fechas vienen de boundsMap).
    const collect = (task: SummaryCalcRow): SummaryStats => {
      const key = task.id.toString();
      const cached = memo.get(key);
      if (cached) return cached;

      const children = childrenByParent.get(key) ?? [];
      let weightedProgress = 0;
      let progressWeight = 0;
      let fallbackProgress = 0;
      let fallbackCount = 0;
      let estimatedHours = 0;

      if (children.length === 0) {
        if (task.type !== 'summary') {
          const weight = Number(task.duration.toString());
          if (weight > 0) {
            weightedProgress += weight * task.progress;
            progressWeight += weight;
          } else {
            fallbackProgress += task.progress;
            fallbackCount++;
          }
          const ownHours = Number(task.estimatedHours.toString());
          if (Number.isFinite(ownHours) && ownHours > 0)
            estimatedHours += ownHours;
        }
      } else {
        for (const child of children) {
          const childStats = collect(child);
          weightedProgress += childStats.weightedProgress;
          progressWeight += childStats.progressWeight;
          fallbackProgress += childStats.fallbackProgress;
          fallbackCount += childStats.fallbackCount;
          estimatedHours += childStats.estimatedHours;
        }
      }

      const result = {
        weightedProgress,
        progressWeight,
        fallbackProgress,
        fallbackCount,
        estimatedHours,
      };
      memo.set(key, result);
      return result;
    };

    const patches: SummaryPatch[] = [];
    const previousById = new Map<
      string,
      {
        startDate: Date;
        endDate: Date;
        duration: string;
        progress: number;
        estimatedHours: string;
      }
    >();
    for (const task of tasks) {
      if (task.type === 'summary') {
        previousById.set(task.id.toString(), {
          startDate: task.startDate,
          endDate: task.endDate,
          duration: task.duration.toString(),
          progress: task.progress,
          estimatedHours: task.estimatedHours.toString(),
        });
      }
    }

    for (const summary of tasks.filter((task) => task.type === 'summary')) {
      const stats = collect(summary);
      const bounds = boundsMap.get(summary.id.toString());
      if (!bounds) continue;
      const startDate = new Date(bounds.start);
      const endDate = new Date(bounds.end);

      const progress =
        stats.progressWeight > 0
          ? Math.round(stats.weightedProgress / stats.progressWeight)
          : stats.fallbackCount > 0
            ? Math.round(stats.fallbackProgress / stats.fallbackCount)
            : 0;
      const clampedProgress = Math.max(0, Math.min(100, progress));
      const duration = Math.max(
        0,
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        ),
      ).toString();

      const aggregatedHours = stats.estimatedHours.toFixed(2);
      const prev = previousById.get(summary.id.toString());
      const unchanged =
        prev &&
        prev.startDate.getTime() === startDate.getTime() &&
        prev.endDate.getTime() === endDate.getTime() &&
        prev.duration === duration &&
        prev.progress === clampedProgress &&
        Number(prev.estimatedHours) === Number(aggregatedHours);
      if (unchanged) continue;

      const updated = await client.task.update({
        where: { id: summary.id },
        data: {
          startDate,
          endDate,
          duration,
          progress: clampedProgress,
          estimatedHours: new Prisma.Decimal(aggregatedHours),
          version: { increment: 1 },
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          duration: true,
          progress: true,
          estimatedHours: true,
          version: true,
        },
      });
      patches.push({
        id: updated.id.toString(),
        startDate: updated.startDate.toISOString(),
        endDate: updated.endDate.toISOString(),
        duration: updated.duration.toString(),
        progress: updated.progress,
        estimatedHours: updated.estimatedHours.toString(),
        version: updated.version,
      });
    }
    return patches;
  }
}
