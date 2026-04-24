import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateProgressDto,
  UpdateOrderDto,
  TaskResponse,
} from '@project-workgroup/shared';
import { statusToPrisma, statusToWire, priorityToPrisma, priorityToWire } from './wire';
import { firstOrder, between, after } from './fractional-index';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(t: {
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
  }): TaskResponse {
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

  /** Resolve the order value for a new/moved task given optional neighbor IDs */
  private async resolveNeighborOrders(
    projectId: bigint,
    afterTaskId?: string,
    beforeTaskId?: string,
  ): Promise<string> {
    let afterOrder: string | null = null;
    let beforeOrder: string | null = null;

    if (afterTaskId) {
      const t = await this.prisma.task.findUnique({ where: { id: BigInt(afterTaskId) } });
      if (t && t.projectId === projectId) afterOrder = t.order.toString();
    }
    if (beforeTaskId) {
      const t = await this.prisma.task.findUnique({ where: { id: BigInt(beforeTaskId) } });
      if (t && t.projectId === projectId) beforeOrder = t.order.toString();
    }

    if (afterOrder === null && beforeOrder === null) {
      // Append to end: find max order
      const last = await this.prisma.task.findFirst({
        where: { projectId },
        orderBy: { order: 'desc' },
      });
      return last ? after(last.order.toString()) : firstOrder();
    }

    if (afterOrder !== null && beforeOrder === null) {
      return after(afterOrder);
    }

    return between(afterOrder, beforeOrder);
  }

  async list(projectId: bigint): Promise<TaskResponse[]> {
    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
    return tasks.map((t) => this.toResponse(t));
  }

  async create(projectId: bigint, dto: CreateTaskDto): Promise<TaskResponse> {
    const order = await this.resolveNeighborOrders(projectId, dto.afterTaskId);
    const duration =
      Math.max(
        1,
        Math.ceil(
          (new Date(dto.endDate).getTime() - new Date(dto.startDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );

    const task = await this.prisma.task.create({
      data: {
        projectId,
        parentId: dto.parentId ? BigInt(dto.parentId) : null,
        assigneeId: dto.assigneeId ? BigInt(dto.assigneeId) : null,
        name: dto.name,
        description: dto.description ?? null,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        duration: duration.toString(),
        priority: priorityToPrisma(dto.priority),
        status: statusToPrisma(dto.status),
        type: dto.type as any,
        color: dto.color,
        order,
      },
    });
    return this.toResponse(task);
  }

  async getById(id: bigint): Promise<TaskResponse> {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('task not found');
    return this.toResponse(task);
  }

  async update(id: bigint, dto: UpdateTaskDto): Promise<TaskResponse> {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('task not found');

    const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    const duration = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.startDate !== undefined && { startDate, duration: duration.toString() }),
        ...(dto.endDate !== undefined && { endDate, duration: duration.toString() }),
        ...(dto.priority !== undefined && { priority: priorityToPrisma(dto.priority) }),
        ...(dto.status !== undefined && { status: statusToPrisma(dto.status) }),
        ...(dto.type !== undefined && { type: dto.type as any }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId ? BigInt(dto.assigneeId) : null }),
        ...(dto.open !== undefined && { open: dto.open }),
      },
    });
    return this.toResponse(task);
  }

  async updateProgress(id: bigint, dto: UpdateProgressDto): Promise<TaskResponse> {
    const task = await this.prisma.task.update({
      where: { id },
      data: { progress: dto.progress },
    });
    return this.toResponse(task);
  }

  async updateOrder(id: bigint, dto: UpdateOrderDto): Promise<TaskResponse> {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('task not found');
    const order = await this.resolveNeighborOrders(existing.projectId, dto.afterTaskId, dto.beforeTaskId);
    const task = await this.prisma.task.update({ where: { id }, data: { order } });
    return this.toResponse(task);
  }

  async remove(id: bigint): Promise<void> {
    await this.prisma.task.delete({ where: { id } });
  }
}
