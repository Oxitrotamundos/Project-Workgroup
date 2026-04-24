import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddProjectMemberDto, ProjectMemberResponse } from '@project-workgroup/shared';

@Injectable()
export class ProjectMembersService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(m: {
    projectId: bigint;
    userId: bigint;
    projectRole: string;
    createdAt: Date;
  }): ProjectMemberResponse {
    return {
      projectId: m.projectId.toString(),
      userId: m.userId.toString(),
      projectRole: m.projectRole as ProjectMemberResponse['projectRole'],
      createdAt: m.createdAt.toISOString(),
    };
  }

  async add(projectId: bigint, dto: AddProjectMemberDto): Promise<ProjectMemberResponse> {
    const userId = BigInt(dto.userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user not found');

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (existing) throw new BadRequestException('user is already a member of this project');

    const member = await this.prisma.projectMember.create({
      data: { projectId, userId, projectRole: dto.projectRole },
    });
    return this.toResponse(member);
  }

  async list(projectId: bigint): Promise<ProjectMemberResponse[]> {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => this.toResponse(m));
  }

  async remove(projectId: bigint, userId: bigint): Promise<void> {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) throw new NotFoundException('member not found');
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }
}
