import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateProgressDto,
  UpdateOrderDto,
  TaskResponse,
} from '@project-workgroup/shared';
import { AuthUser } from '../auth/auth.guard';
import { statusToPrisma, statusToWire, priorityToPrisma, priorityToWire } from './wire';
import { firstOrder, between, after } from './fractional-index';

type TaskRow = {
  id: bigint;
  projectId: bigint;
  parentId: bigint | null;
  assigneeId: bigint | null;
  name: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  duration: { toString(): string };
  progress: number;
  priority: string;
  status: string;
  type: string;
  color: string;
  order: { toString(): string };
  open: boolean;
  tags: string[];
  estimatedHours: { toString(): string };
  actualHours: { toString(): string } | null;
  createdAt: Date;
  updatedAt: Date;
};

type SummaryCalcRow = Pick<TaskRow, 'id' | 'parentId' | 'startDate' | 'endDate' | 'duration' | 'progress' | 'type'>;
type SummaryStats = {
  startDate: Date | null;
  endDate: Date | null;
  weightedProgress: number;
  progressWeight: number;
  fallbackProgress: number;
  fallbackCount: number;
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(t: TaskRow): TaskResponse {
    return {
      id: t.id.toString(),
      projectId: t.projectId.toString(),
      parentId: t.parentId?.toString() ?? null,
      assigneeId: t.assigneeId?.toString() ?? null,
      name: t.name,
      description: t.description,
      startDate: t.startDate.toISOString().slice(0, 10),
      endDate: t.endDate.toISOString().slice(0, 10),
      duration: t.duration.toString(),
      progress: t.progress,
      priority: priorityToWire(t.priority as any),
      status: statusToWire(t.status as any),
      type: t.type as any,
      color: t.color,
      order: t.order.toString(),
      open: t.open,
      tags: t.tags,
      estimatedHours: t.estimatedHours.toString(),
      actualHours: t.actualHours?.toString() ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  private async assertProjectAccess(projectId: bigint, user: AuthUser): Promise<void> {
    if (user.role === 'admin') return;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project) throw new NotFoundException('project not found');
    if (project.ownerId === user.id) return;

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!membership) throw new ForbiddenException('not a project member');
  }

  private async assertTaskAccess(taskId: bigint, user: AuthUser): Promise<TaskRow> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('task not found');
    await this.assertProjectAccess(task.projectId, user);
    return task;
  }

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return date;
  }

  private parseBigInt(value: string, field: string): bigint {
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(`${field} must be a valid id`);
    }
  }

  private normalizeSchedule(type: string, rawStart: Date, rawEnd: Date): { startDate: Date; endDate: Date; duration: string } {
    const startDate = new Date(rawStart);
    const endDate = type === 'milestone' ? new Date(startDate) : new Date(rawEnd);

    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('endDate must be greater than or equal to startDate');
    }

    if (type === 'milestone') {
      return { startDate, endDate, duration: '0' };
    }

    return {
      startDate,
      endDate,
      duration: this.durationDays(startDate, endDate).toString(),
    };
  }

  private durationDays(startDate: Date, endDate: Date): number {
    return Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
    );
  }

  private async resolveAssigneeId(assigneeId?: string): Promise<bigint | null | undefined> {
    if (assigneeId === undefined) return undefined;
    if (!assigneeId) return null;

    const id = this.parseBigInt(assigneeId, 'assigneeId');
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new BadRequestException('assigneeId must reference an existing user');
    return id;
  }

  private async validateParent(projectId: bigint, taskId: bigint | null, parentId?: string | null): Promise<bigint | null | undefined> {
    if (parentId === undefined) return undefined;
    if (parentId === null || parentId === '') return null;

    const newParentId = this.parseBigInt(parentId, 'parentId');
    if (taskId !== null && newParentId === taskId) {
      throw new BadRequestException('parentId cannot be the task itself');
    }

    const newParent = await this.prisma.task.findUnique({
      where: { id: newParentId },
      select: { projectId: true, parentId: true },
    });
    if (!newParent || newParent.projectId !== projectId) {
      throw new BadRequestException('parentId must be a task in the same project');
    }

    let cursor: bigint | null = newParent.parentId;
    while (cursor !== null) {
      if (taskId !== null && cursor === taskId) {
        throw new BadRequestException('parentId would create a cycle');
      }
      const ancestor = await this.prisma.task.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = ancestor?.parentId ?? null;
    }

    return newParentId;
  }

  private async resolveNeighborOrders(
    projectId: bigint,
    afterTaskId?: string,
    beforeTaskId?: string,
  ): Promise<string> {
    let afterOrder: string | null = null;
    let beforeOrder: string | null = null;

    if (afterTaskId) {
      const t = await this.prisma.task.findUnique({ where: { id: this.parseBigInt(afterTaskId, 'afterTaskId') } });
      if (!t || t.projectId !== projectId) {
        throw new BadRequestException('afterTaskId must be a task in the same project');
      }
      afterOrder = t.order.toString();
    }

    if (beforeTaskId) {
      const t = await this.prisma.task.findUnique({ where: { id: this.parseBigInt(beforeTaskId, 'beforeTaskId') } });
      if (!t || t.projectId !== projectId) {
        throw new BadRequestException('beforeTaskId must be a task in the same project');
      }
      beforeOrder = t.order.toString();
    }

    if (afterTaskId && beforeTaskId && afterTaskId === beforeTaskId) {
      throw new BadRequestException('afterTaskId and beforeTaskId must be different tasks');
    }

    if (afterOrder === null && beforeOrder === null) {
      const last = await this.prisma.task.findFirst({
        where: { projectId },
        orderBy: { order: 'desc' },
      });
      return last ? after(last.order.toString()) : firstOrder();
    }

    if (afterOrder !== null && beforeOrder === null) {
      return after(afterOrder);
    }

    try {
      return between(afterOrder, beforeOrder);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'invalid order bounds');
    }
  }

  private async recalculateProjectSummaries(projectId: bigint): Promise<void> {
    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      select: {
        id: true,
        parentId: true,
        startDate: true,
        endDate: true,
        duration: true,
        progress: true,
        type: true,
      },
    });

    const childrenByParent = new Map<string, SummaryCalcRow[]>();
    for (const task of tasks) {
      if (task.parentId === null) continue;
      const key = task.parentId.toString();
      childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), task]);
    }

    const memo = new Map<string, SummaryStats>();

    const collect = (task: SummaryCalcRow): SummaryStats => {
      const key = task.id.toString();
      const cached = memo.get(key);
      if (cached) return cached;

      const children = childrenByParent.get(key) ?? [];
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      let weightedProgress = 0;
      let progressWeight = 0;
      let fallbackProgress = 0;
      let fallbackCount = 0;

      const includeBounds = (start: Date | null, end: Date | null) => {
        if (start && (!startDate || start.getTime() < startDate.getTime())) startDate = start;
        if (end && (!endDate || end.getTime() > endDate.getTime())) endDate = end;
      };

      if (children.length === 0) {
        includeBounds(task.startDate, task.endDate);
        if (task.type !== 'summary') {
          const weight = Number(task.duration.toString());
          if (weight > 0) {
            weightedProgress += weight * task.progress;
            progressWeight += weight;
          } else {
            fallbackProgress += task.progress;
            fallbackCount++;
          }
        }
      } else {
        for (const child of children) {
          const childStats = collect(child);
          includeBounds(childStats.startDate, childStats.endDate);
          weightedProgress += childStats.weightedProgress;
          progressWeight += childStats.progressWeight;
          fallbackProgress += childStats.fallbackProgress;
          fallbackCount += childStats.fallbackCount;
        }
      }

      const result = { startDate, endDate, weightedProgress, progressWeight, fallbackProgress, fallbackCount };
      memo.set(key, result);
      return result;
    };

    for (const summary of tasks.filter((task) => task.type === 'summary')) {
      const stats = collect(summary);
      const hasChildren = (childrenByParent.get(summary.id.toString()) ?? []).length > 0;
      if (!hasChildren || !stats.startDate || !stats.endDate) continue;

      const progress =
        stats.progressWeight > 0
          ? Math.round(stats.weightedProgress / stats.progressWeight)
          : stats.fallbackCount > 0
            ? Math.round(stats.fallbackProgress / stats.fallbackCount)
            : 0;
      const duration = Math.max(
        0,
        Math.ceil((stats.endDate.getTime() - stats.startDate.getTime()) / (1000 * 60 * 60 * 24)),
      ).toString();

      await this.prisma.task.update({
        where: { id: summary.id },
        data: {
          startDate: stats.startDate,
          endDate: stats.endDate,
          duration,
          progress: Math.max(0, Math.min(100, progress)),
        },
      });
    }
  }

  async list(projectId: bigint): Promise<TaskResponse[]> {
    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
    return tasks.map((t) => this.toResponse(t));
  }

  async create(projectId: bigint, dto: CreateTaskDto): Promise<TaskResponse> {
    const parentId = await this.validateParent(projectId, null, dto.parentId);
    const assigneeId = await this.resolveAssigneeId(dto.assigneeId);
    const order = await this.resolveNeighborOrders(projectId, dto.afterTaskId);
    const schedule = this.normalizeSchedule(
      dto.type,
      this.parseDate(dto.startDate, 'startDate'),
      this.parseDate(dto.endDate, 'endDate'),
    );

    const task = await this.prisma.task.create({
      data: {
        projectId,
        parentId: parentId ?? null,
        assigneeId: assigneeId ?? null,
        name: dto.name,
        description: dto.description ?? null,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        duration: schedule.duration,
        priority: priorityToPrisma(dto.priority),
        status: statusToPrisma(dto.status),
        type: dto.type as any,
        color: dto.color,
        order,
      },
    });

    await this.recalculateProjectSummaries(projectId);
    const refreshed = await this.prisma.task.findUnique({ where: { id: task.id } });
    return this.toResponse(refreshed ?? task);
  }

  async getById(id: bigint, user: AuthUser): Promise<TaskResponse> {
    const task = await this.assertTaskAccess(id, user);
    return this.toResponse(task);
  }

  async update(id: bigint, dto: UpdateTaskDto, user: AuthUser): Promise<TaskResponse> {
    const existing = await this.assertTaskAccess(id, user);
    const nextType = dto.type ?? (existing.type as any);
    const schedule = this.normalizeSchedule(
      nextType,
      dto.startDate ? this.parseDate(dto.startDate, 'startDate') : existing.startDate,
      dto.endDate ? this.parseDate(dto.endDate, 'endDate') : existing.endDate,
    );

    const parentId = await this.validateParent(existing.projectId, id, dto.parentId);
    const assigneeId = await this.resolveAssigneeId(dto.assigneeId);

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...((dto.startDate !== undefined || dto.endDate !== undefined || dto.type !== undefined) && {
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          duration: schedule.duration,
        }),
        ...(dto.priority !== undefined && { priority: priorityToPrisma(dto.priority) }),
        ...(dto.status !== undefined && { status: statusToPrisma(dto.status) }),
        ...(dto.type !== undefined && { type: dto.type as any }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(assigneeId !== undefined && { assigneeId }),
        ...(dto.open !== undefined && { open: dto.open }),
        ...(parentId !== undefined && { parentId }),
      },
    });

    await this.recalculateProjectSummaries(existing.projectId);
    const refreshed = await this.prisma.task.findUnique({ where: { id } });
    return this.toResponse(refreshed ?? task);
  }

  async updateProgress(id: bigint, dto: UpdateProgressDto, user: AuthUser): Promise<TaskResponse> {
    const existing = await this.assertTaskAccess(id, user);
    const task = await this.prisma.task.update({
      where: { id },
      data: { progress: dto.progress },
    });
    await this.recalculateProjectSummaries(existing.projectId);
    const refreshed = await this.prisma.task.findUnique({ where: { id } });
    return this.toResponse(refreshed ?? task);
  }

  async updateOrder(id: bigint, dto: UpdateOrderDto, user: AuthUser): Promise<TaskResponse> {
    const existing = await this.assertTaskAccess(id, user);
    const order = await this.resolveNeighborOrders(existing.projectId, dto.afterTaskId, dto.beforeTaskId);
    const task = await this.prisma.task.update({ where: { id }, data: { order } });
    await this.recalculateProjectSummaries(existing.projectId);
    return this.toResponse(task);
  }

  async remove(id: bigint, user: AuthUser): Promise<void> {
    const existing = await this.assertTaskAccess(id, user);
    await this.prisma.task.delete({ where: { id } });
    await this.recalculateProjectSummaries(existing.projectId);
  }
}
