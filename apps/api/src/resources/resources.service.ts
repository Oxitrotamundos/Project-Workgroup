import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateResourceDto,
  ListResourcesQueryDto,
  ResourceResponse,
  UpdateResourceDto,
} from '@project-workgroup/shared';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(r: {
    id: bigint;
    name: string;
    email: string | null;
    kind: string;
    status: string;
    userId: bigint | null;
    avatarUrl: string | null;
    discipline: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ResourceResponse {
    return {
      id: r.id.toString(),
      name: r.name,
      email: r.email,
      kind: r.kind as ResourceResponse['kind'],
      status: r.status as ResourceResponse['status'],
      userId: r.userId ? r.userId.toString() : null,
      avatarUrl: r.avatarUrl,
      discipline: r.discipline,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async list(q: ListResourcesQueryDto) {
    const take = Math.min(q.limit ?? 25, 100);
    const where: any = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' as const } },
        { email: { contains: q.search, mode: 'insensitive' as const } },
      ];
    }
    if (q.kind) where.kind = q.kind;
    if (q.status) where.status = q.status;
    const cursor = q.cursor ? { id: BigInt(q.cursor) } : undefined;
    const rows = await this.prisma.resource.findMany({
      where,
      take: take + 1,
      cursor,
      skip: cursor ? 1 : 0,
      orderBy: { id: 'asc' },
    });
    const hasMore = rows.length > take;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((r) =>
      this.toResponse(r),
    );
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  async getById(id: bigint): Promise<ResourceResponse> {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException('resource not found');
    return this.toResponse(resource);
  }

  async create(dto: CreateResourceDto): Promise<ResourceResponse> {
    // Este endpoint solo crea placeholders; el resource de un usuario real se
    // crea en auth.sync, no aquí.
    const resource = await this.prisma.resource.create({
      data: {
        name: dto.name,
        email: dto.email ?? null,
        avatarUrl: dto.avatarUrl ?? null,
        discipline: dto.discipline ?? null,
        kind: 'placeholder',
      },
    });
    return this.toResponse(resource);
  }

  async update(id: bigint, dto: UpdateResourceDto): Promise<ResourceResponse> {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException('resource not found');
    // En resources enlazados a un user, name/email/avatarUrl los gobierna el perfil
    // (auth.sync los re-sincroniza en cada login), así que aquí son de solo lectura:
    // el admin solo ajusta discipline/status. En placeholders todo es editable.
    const isUserLinked = resource.kind === 'user';
    const updated = await this.prisma.resource.update({
      where: { id },
      data: {
        name: isUserLinked ? undefined : (dto.name ?? undefined),
        email: isUserLinked ? undefined : (dto.email ?? undefined),
        avatarUrl: isUserLinked ? undefined : (dto.avatarUrl ?? undefined),
        discipline: dto.discipline ?? undefined,
        status: dto.status ?? undefined,
      },
    });
    return this.toResponse(updated);
  }

  async linkToUser(
    resourceId: bigint,
    userId: bigint,
  ): Promise<ResourceResponse> {
    return this.prisma.$transaction(async (tx) => {
      const placeholder = await tx.resource.findUnique({
        where: { id: resourceId },
      });
      if (!placeholder) throw new NotFoundException('resource not found');
      if (placeholder.kind !== 'placeholder')
        throw new BadRequestException('resource is not a placeholder');

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('user not found');

      // El user ya trae su resource auto-generado (invariante de auth.sync): hay
      // que fusionar los dos. Reasignamos su trabajo al placeholder y lo borramos.
      // Tareas y workload de ambos son disjuntos por task (una tarea tiene un solo
      // assignee), así que el traspaso no colisiona con el índice único de workload.
      const userResource = await tx.resource.findUnique({ where: { userId } });
      if (userResource && userResource.id !== resourceId) {
        await tx.task.updateMany({
          where: { assigneeId: userResource.id },
          data: { assigneeId: resourceId },
        });
        await tx.workload.updateMany({
          where: { resourceId: userResource.id },
          data: { resourceId },
        });
        await tx.resource.delete({ where: { id: userResource.id } });
      }

      const linked = await tx.resource.update({
        where: { id: resourceId },
        data: { kind: 'user', userId, email: user.email },
      });
      return this.toResponse(linked);
    });
  }

  async remove(id: bigint): Promise<void> {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      include: { _count: { select: { assignedTasks: true, workload: true } } },
    });
    if (!resource) throw new NotFoundException('resource not found');
    if (resource.kind !== 'placeholder')
      throw new BadRequestException(
        'only placeholder resources can be deleted',
      );
    if (resource._count.assignedTasks > 0 || resource._count.workload > 0)
      throw new ConflictException(
        'resource has assigned tasks or workload; reassign them first',
      );
    await this.prisma.resource.delete({ where: { id } });
  }
}
