import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRE_PROJECT_KEY } from './require-project.decorator';

@Injectable()
export class ProjectMembershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const paramName = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_PROJECT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!paramName) return true;
    const req = context.switchToHttp().getRequest<{ user?: { id: bigint; role: string }; params: Record<string, string> }>();
    if (req.user?.role === 'admin') return true;
    const raw = req.params[paramName];
    if (!raw) throw new ForbiddenException('missing project param');
    const projectId = BigInt(raw);
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('project not found');
    if (project.ownerId === req.user?.id) return true;
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.user!.id } },
    });
    if (!membership) throw new ForbiddenException('not a project member');
    return true;
  }
}
