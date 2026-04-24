import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeyResponse, CreateApiKeyDto, CreateApiKeyResponse } from '@project-workgroup/shared';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: bigint): Promise<ApiKeyResponse[]> {
    const rows = await this.prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toResponse(r));
  }

  async create(userId: bigint, dto: CreateApiKeyDto): Promise<CreateApiKeyResponse> {
    const raw = this.generatePlaintext();
    const keyHash = await argon2.hash(raw, { type: argon2.argon2id });
    const prefix = raw.slice(0, 8);
    const row = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        keyHash,
        prefix,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    return { ...this.toResponse(row), plaintext: raw };
  }

  async revoke(userId: bigint, id: bigint): Promise<void> {
    const row = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!row || row.userId !== userId) throw new NotFoundException('api key not found');
    await this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  private generatePlaintext(): string {
    return `pwg_${randomBytes(32).toString('base64url')}`;
  }

  private toResponse(r: any): ApiKeyResponse {
    return {
      id: r.id.toString(),
      name: r.name,
      prefix: r.prefix,
      lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
