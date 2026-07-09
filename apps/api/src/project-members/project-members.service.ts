import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddProjectMemberDto,
  ProjectMemberResponse,
} from '@project-workgroup/shared';

@Injectable()
export class ProjectMembersService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(m: {
    projectId: bigint;
    userId: bigint;
    projectRole: string;
    createdAt: Date;
    user: {
      id: bigint;
      email: string;
      displayName: string;
      role: string;
      status: string;
      avatarUrl: string | null;
    };
  }): ProjectMemberResponse {
    return {
      projectId: m.projectId.toString(),
      userId: m.userId.toString(),
      projectRole: m.projectRole as ProjectMemberResponse['projectRole'],
      user: {
        id: m.user.id.toString(),
        email: m.user.email,
        displayName: m.user.displayName,
        role: m.user.role as ProjectMemberResponse['user']['role'],
        status: m.user.status as ProjectMemberResponse['user']['status'],
        avatarUrl: m.user.avatarUrl,
      },
      createdAt: m.createdAt.toISOString(),
    };
  }

  async add(
    projectId: bigint,
    dto: AddProjectMemberDto,
  ): Promise<ProjectMemberResponse> {
    const userId = BigInt(dto.userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user not found');

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (existing)
      throw new BadRequestException('user is already a member of this project');

    const member = await this.prisma.projectMember.create({
      data: { projectId, userId, projectRole: dto.projectRole },
      include: { user: true },
    });
    return this.toResponse(member);
  }

  async list(projectId: bigint): Promise<ProjectMemberResponse[]> {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      include: { user: true },
    });
    return members.map((m) => this.toResponse(m));
  }

  async updateRole(
    projectId: bigint,
    userId: bigint,
    projectRole: AddProjectMemberDto['projectRole'],
  ): Promise<ProjectMemberResponse> {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) throw new NotFoundException('member not found');
    const updated = await this.prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { projectRole },
      include: { user: true },
    });
    return this.toResponse(updated);
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
