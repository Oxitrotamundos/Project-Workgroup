import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkloadDto, WorkloadQueryDto, WorkloadResponse } from '@project-workgroup/shared';

@Injectable()
export class WorkloadService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(w: {
    id: bigint;
    userId: bigint;
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
      userId: w.userId.toString(),
      taskId: w.taskId.toString(),
      projectId: w.projectId.toString(),
      date: w.date.toISOString().slice(0, 10),
      allocatedHours: w.allocatedHours.toString(),
      actualHours: w.actualHours?.toString() ?? null,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    };
  }

  async create(projectId: bigint, dto: CreateWorkloadDto): Promise<WorkloadResponse> {
    const task = await this.prisma.task.findUnique({ where: { id: BigInt(dto.taskId) } });
    if (!task) throw new NotFoundException('task not found');

    const workload = await this.prisma.workload.create({
      data: {
        userId: BigInt(dto.userId),
        taskId: BigInt(dto.taskId),
        projectId,
        date: new Date(dto.date),
        allocatedHours: dto.allocatedHours,
        actualHours: dto.actualHours ?? null,
      },
    });
    return this.toResponse(workload);
  }

  async query(projectId: bigint, q: WorkloadQueryDto): Promise<WorkloadResponse[]> {
    const where: any = { projectId };
    if (q.userId) where.userId = BigInt(q.userId);
    if (q.dateFrom || q.dateTo) {
      where.date = {};
      if (q.dateFrom) where.date.gte = new Date(q.dateFrom);
      if (q.dateTo) where.date.lte = new Date(q.dateTo);
    }
    const rows = await this.prisma.workload.findMany({
      where,
      orderBy: [{ date: 'asc' }, { userId: 'asc' }],
    });
    return rows.map((w) => this.toResponse(w));
  }

  async remove(id: bigint): Promise<void> {
    const w = await this.prisma.workload.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('workload entry not found');
    await this.prisma.workload.delete({ where: { id } });
  }
}
