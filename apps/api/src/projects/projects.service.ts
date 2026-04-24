import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto, ProjectResponse } from '@project-workgroup/shared';
import { toPrisma, toWire } from './status.mapper';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(p: {
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
      status: toWire(p.status as any),
      ownerId: p.ownerId.toString(),
      color: p.color,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async create(dto: CreateProjectDto, ownerId: bigint): Promise<ProjectResponse> {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: toPrisma(dto.status),
        ownerId,
        color: dto.color,
      },
    });
    return this.toResponse(project);
  }

  async listForUser(userId: bigint): Promise<ProjectResponse[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    return projects.map((p) => this.toResponse(p));
  }

  async getById(id: bigint): Promise<ProjectResponse> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('project not found');
    return this.toResponse(project);
  }

  async update(id: bigint, dto: UpdateProjectDto): Promise<ProjectResponse> {
    const project = await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.status !== undefined && { status: toPrisma(dto.status) }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
    });
    return this.toResponse(project);
  }

  async remove(id: bigint): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }
}
