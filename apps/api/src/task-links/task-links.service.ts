import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskLinkDto, TaskLinkResponse } from '@project-workgroup/shared';
import { wouldCreateCycle, Edge } from './cycle-detector';

@Injectable()
export class TaskLinksService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(l: {
    id: bigint;
    projectId: bigint;
    sourceTaskId: bigint;
    targetTaskId: bigint;
    type: string;
    createdAt: Date;
  }): TaskLinkResponse {
    return {
      id: l.id.toString(),
      projectId: l.projectId.toString(),
      sourceTaskId: l.sourceTaskId.toString(),
      targetTaskId: l.targetTaskId.toString(),
      type: l.type as TaskLinkResponse['type'],
      createdAt: l.createdAt.toISOString(),
    };
  }

  async create(projectId: bigint, dto: CreateTaskLinkDto): Promise<TaskLinkResponse> {
    const sourceId = BigInt(dto.sourceTaskId);
    const targetId = BigInt(dto.targetTaskId);

    return this.prisma.$transaction(async (tx) => {
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

  async remove(id: bigint): Promise<void> {
    const link = await this.prisma.taskLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException('task link not found');
    await this.prisma.taskLink.delete({ where: { id } });
  }
}
