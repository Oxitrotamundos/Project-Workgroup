import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: { search?: string; limit?: number; cursor?: string }) {
    const take = Math.min(params.limit ?? 25, 100);
    const where = params.search
      ? { OR: [
          { email: { contains: params.search, mode: 'insensitive' as const } },
          { displayName: { contains: params.search, mode: 'insensitive' as const } },
        ] }
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
      avatarUrl: u.avatarUrl,
    }));
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }
}
