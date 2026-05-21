import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ProjectRole } from '@project-workgroup/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  REQUIRE_PROJECT_KEY,
  RequireProjectMetadata,
} from './require-project.decorator';

const PROJECT_ROLE_RANK: Record<ProjectRole, number> = {
  viewer: 1,
  contributor: 2,
  manager: 3,
};

@Injectable()
export class ProjectMembershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<
      RequireProjectMetadata | undefined
    >(REQUIRE_PROJECT_KEY, [context.getHandler(), context.getClass()]);
    if (!meta) return true;
    const { paramName, minRole } = meta;
    const req = context.switchToHttp().getRequest<{
      user?: { id: bigint; role: string };
      params: Record<string, string>;
    }>();
    if (req.user?.role === 'admin') return true;
    const raw = req.params[paramName];
    if (!raw) throw new ForbiddenException('missing project param');
    let projectId: bigint;
    try {
      projectId = BigInt(raw);
    } catch {
      throw new BadRequestException(`${paramName} must be a valid id`);
    }
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project) throw new NotFoundException('project not found');
    if (project.ownerId === req.user?.id) return true;
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.user!.id } },
      select: { projectRole: true },
    });
    if (!membership) throw new ForbiddenException('not a project member');
    if (minRole) {
      const userRank = PROJECT_ROLE_RANK[membership.projectRole as ProjectRole];
      const requiredRank = PROJECT_ROLE_RANK[minRole];
      if (userRank < requiredRank)
        throw new ForbiddenException('insufficient project role');
    }
    return true;
  }
}
