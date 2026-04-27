import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskLinkDto, TaskLinkResponse, UpdateTaskLinkDto } from '@project-workgroup/shared';
import { AuthUser } from '../auth/auth.guard';
import { wouldCreateCycle, Edge } from './cycle-detector';

type TaskLinkRow = {
  id: bigint;
  projectId: bigint;
  sourceTaskId: bigint;
  targetTaskId: bigint;
  type: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class TaskLinksService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(l: TaskLinkRow): TaskLinkResponse {
    return {
      id: l.id.toString(),
      projectId: l.projectId.toString(),
      sourceTaskId: l.sourceTaskId.toString(),
      targetTaskId: l.targetTaskId.toString(),
      type: l.type as TaskLinkResponse['type'],
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    };
  }

  private parseBigInt(value: string, field: string): bigint {
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(`${field} must be a valid id`);
    }
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

  private async assertTaskAccess(taskId: bigint, user: AuthUser): Promise<bigint> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (!task) throw new NotFoundException('task not found');
    await this.assertProjectAccess(task.projectId, user);
    return task.projectId;
  }

  private async assertLinkAccess(id: bigint, user: AuthUser): Promise<TaskLinkRow> {
    const link = await this.prisma.taskLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException('task link not found');
    await this.assertProjectAccess(link.projectId, user);
    return link;
  }

  async create(projectId: bigint, dto: CreateTaskLinkDto): Promise<TaskLinkResponse> {
    const sourceId = this.parseBigInt(dto.sourceTaskId, 'sourceTaskId');
    const targetId = this.parseBigInt(dto.targetTaskId, 'targetTaskId');

    if (sourceId === targetId) {
      throw new BadRequestException('sourceTaskId and targetTaskId must be different tasks');
    }

    return this.prisma.$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.task.findUnique({ where: { id: sourceId }, select: { projectId: true } }),
        tx.task.findUnique({ where: { id: targetId }, select: { projectId: true } }),
      ]);

      if (!source || source.projectId !== projectId) {
        throw new BadRequestException('sourceTaskId must be a task in the same project');
      }
      if (!target || target.projectId !== projectId) {
        throw new BadRequestException('targetTaskId must be a task in the same project');
      }

      const existing = await tx.taskLink.findUnique({
        where: {
          sourceTaskId_targetTaskId_type: {
            sourceTaskId: sourceId,
            targetTaskId: targetId,
            type: dto.type as any,
          },
        },
      });
      if (existing) throw new ConflictException('link already exists');

      const allEdges = await tx.taskLink.findMany({
        where: { projectId },
        select: { sourceTaskId: true, targetTaskId: true },
      });
      const edges: Edge[] = allEdges.map((e) => ({
        sourceTaskId: e.sourceTaskId.toString(),
        targetTaskId: e.targetTaskId.toString(),
      }));

      if (wouldCreateCycle(edges, dto.sourceTaskId, dto.targetTaskId)) {
        throw new ConflictException('adding this link would create a cycle');
      }

      const link = await tx.taskLink.create({
        data: {
          projectId,
          sourceTaskId: sourceId,
          targetTaskId: targetId,
          type: dto.type as any,
        },
      });
      return this.toResponse(link);
    });
  }

  async list(projectId: bigint): Promise<TaskLinkResponse[]> {
    const links = await this.prisma.taskLink.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return links.map((l) => this.toResponse(l));
  }

  async listSource(taskId: bigint, user: AuthUser): Promise<TaskLinkResponse[]> {
    await this.assertTaskAccess(taskId, user);
    const links = await this.prisma.taskLink.findMany({
      where: { sourceTaskId: taskId },
      orderBy: { createdAt: 'asc' },
    });
    return links.map((l) => this.toResponse(l));
  }

  async listTarget(taskId: bigint, user: AuthUser): Promise<TaskLinkResponse[]> {
    await this.assertTaskAccess(taskId, user);
    const links = await this.prisma.taskLink.findMany({
      where: { targetTaskId: taskId },
      orderBy: { createdAt: 'asc' },
    });
    return links.map((l) => this.toResponse(l));
  }

  async getById(id: bigint, user: AuthUser): Promise<TaskLinkResponse> {
    return this.toResponse(await this.assertLinkAccess(id, user));
  }

  async update(id: bigint, dto: UpdateTaskLinkDto, user: AuthUser): Promise<TaskLinkResponse> {
    const existing = await this.assertLinkAccess(id, user);
    if (dto.type === undefined || dto.type === existing.type) {
      return this.toResponse(existing);
    }

    const duplicate = await this.prisma.taskLink.findUnique({
      where: {
        sourceTaskId_targetTaskId_type: {
          sourceTaskId: existing.sourceTaskId,
          targetTaskId: existing.targetTaskId,
          type: dto.type as any,
        },
      },
    });
    if (duplicate && duplicate.id !== id) throw new ConflictException('link already exists');

    const link = await this.prisma.taskLink.update({
      where: { id },
      data: { type: dto.type as any },
    });
    return this.toResponse(link);
  }

  async remove(id: bigint, user: AuthUser): Promise<void> {
    await this.assertLinkAccess(id, user);
    await this.prisma.taskLink.delete({ where: { id } });
  }
}
