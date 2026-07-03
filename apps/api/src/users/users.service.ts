import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserAdminDto } from '@project-workgroup/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: { search?: string; limit?: number; cursor?: string }) {
    const take = Math.min(params.limit ?? 25, 100);
    const where = params.search
      ? {
          OR: [
            {
              email: { contains: params.search, mode: 'insensitive' as const },
            },
            {
              displayName: {
                contains: params.search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {};
    const cursor = params.cursor ? { id: BigInt(params.cursor) } : undefined;
    const rows = await this.prisma.user.findMany({
      where,
      take: take + 1,
      cursor,
      skip: cursor ? 1 : 0,
      orderBy: { id: 'asc' },
    });
    const hasMore = rows.length > take;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((u) => ({
      id: u.id.toString(),
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      status: u.status,
      avatarUrl: u.avatarUrl,
    }));
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  async adminUpdate(id: bigint, dto: UpdateUserAdminDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('user not found');

    // Impide dejar el sistema sin ningún admin activo.
    const isActiveAdmin = user.role === 'admin' && user.status === 'active';
    const losesActiveAdmin =
      (dto.role !== undefined && dto.role !== 'admin') ||
      dto.status === 'disabled';
    if (isActiveAdmin && losesActiveAdmin) {
      const otherActiveAdmins = await this.prisma.user.count({
        where: { role: 'admin', status: 'active', id: { not: id } },
      });
      if (otherActiveAdmins === 0) {
        throw new BadRequestException('cannot remove the last active admin');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        role: dto.role ?? undefined,
        status: dto.status ?? undefined,
      },
    });
    return {
      id: updated.id.toString(),
      email: updated.email,
      displayName: updated.displayName,
      role: updated.role,
      status: updated.status,
      avatarUrl: updated.avatarUrl,
    };
  }
}
