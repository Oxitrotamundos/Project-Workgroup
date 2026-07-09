import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWorkloadDto,
  WorkloadQueryDto,
  WorkloadResponse,
} from '@project-workgroup/shared';
import { AuthUser } from '../auth/auth.guard';

@Injectable()
export class WorkloadService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(w: {
    id: bigint;
    resourceId: bigint;
    taskId: bigint;
    projectId: bigint;
    date: Date;
    allocatedHours: { toString(): string };
    actualHours: { toString(): string } | null;
    createdAt: Date;
    updatedAt: Date;
  }): WorkloadResponse {
    return {
      id: w.id.toString(),
      resourceId: w.resourceId.toString(),
      taskId: w.taskId.toString(),
      projectId: w.projectId.toString(),
      date: w.date.toISOString().slice(0, 10),
      allocatedHours: w.allocatedHours.toString(),
      actualHours: w.actualHours?.toString() ?? null,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    };
  }

  async create(
    projectId: bigint,
    dto: CreateWorkloadDto,
  ): Promise<WorkloadResponse> {
    const task = await this.prisma.task.findUnique({
      where: { id: BigInt(dto.taskId) },
    });
    if (!task) throw new NotFoundException('task not found');

    const resource = await this.prisma.resource.findUnique({
      where: { id: BigInt(dto.resourceId) },
    });
    if (!resource) throw new NotFoundException('resource not found');

    const workload = await this.prisma.workload.create({
      data: {
        resourceId: BigInt(dto.resourceId),
        taskId: BigInt(dto.taskId),
        projectId,
        date: new Date(dto.date),
        allocatedHours: dto.allocatedHours,
        actualHours: dto.actualHours ?? null,
      },
    });
    return this.toResponse(workload);
  }

  async query(
    projectId: bigint,
    q: WorkloadQueryDto,
  ): Promise<WorkloadResponse[]> {
    const where: any = { projectId };
    if (q.resourceId) where.resourceId = BigInt(q.resourceId);
    if (q.dateFrom || q.dateTo) {
      where.date = {};
      if (q.dateFrom) where.date.gte = new Date(q.dateFrom);
      if (q.dateTo) where.date.lte = new Date(q.dateTo);
    }
    const rows = await this.prisma.workload.findMany({
      where,
      orderBy: [{ date: 'asc' }, { resourceId: 'asc' }],
    });
    return rows.map((w) => this.toResponse(w));
  }

  async remove(id: bigint, user: AuthUser): Promise<void> {
    const w = await this.prisma.workload.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('workload entry not found');
    await this.assertProjectAccess(w.projectId, user);
    await this.prisma.workload.delete({ where: { id } });
  }

  private async assertProjectAccess(
    projectId: bigint,
    user: AuthUser,
  ): Promise<void> {
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
}
