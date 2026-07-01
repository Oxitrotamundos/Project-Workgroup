import { PrismaService } from '../prisma/prisma.service';

// Adapter genérico de node-oidc-provider sobre la tabla key-value oauth_payloads.
// Refleja el contrato del adapter de ejemplo oficial (payload + consumed).
export class PrismaOidcAdapter {
  constructor(
    private readonly name: string,
    private readonly prisma: PrismaService,
  ) {}

  private key(id: string) {
    return { type_id: { type: this.name, id } };
  }

  async upsert(
    id: string,
    payload: Record<string, unknown>,
    expiresIn: number,
  ): Promise<void> {
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;
    const grantId = (payload.grantId as string) ?? null;
    const userCode = (payload.userCode as string) ?? null;
    const uid = (payload.uid as string) ?? null;
    await this.prisma.oAuthPayload.upsert({
      where: this.key(id),
      update: { payload: payload as object, grantId, userCode, uid, expiresAt },
      create: {
        type: this.name,
        id,
        payload: payload as object,
        grantId,
        userCode,
        uid,
        expiresAt,
      },
    });
  }

  async find(id: string): Promise<Record<string, unknown> | undefined> {
    const row = await this.prisma.oAuthPayload.findUnique({
      where: this.key(id),
    });
    if (!row) return undefined;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return undefined;
    const payload = row.payload as Record<string, unknown>;
    return row.consumedAt
      ? { ...payload, consumed: Math.floor(row.consumedAt.getTime() / 1000) }
      : payload;
  }

  async findByUserCode(userCode: string) {
    const row = await this.prisma.oAuthPayload.findFirst({
      where: { type: this.name, userCode },
    });
    return this.materialize(row);
  }

  async findByUid(uid: string) {
    const row = await this.prisma.oAuthPayload.findFirst({
      where: { type: this.name, uid },
    });
    return this.materialize(row);
  }

  async consume(id: string): Promise<void> {
    await this.prisma.oAuthPayload.update({
      where: this.key(id),
      data: { consumedAt: new Date() },
    });
  }

  async destroy(id: string): Promise<void> {
    await this.prisma.oAuthPayload
      .delete({ where: this.key(id) })
      .catch(() => undefined);
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    await this.prisma.oAuthPayload.deleteMany({ where: { grantId } });
  }

  private materialize(
    row: {
      payload: unknown;
      expiresAt: Date | null;
      consumedAt: Date | null;
    } | null,
  ) {
    if (!row) return undefined;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return undefined;
    const payload = row.payload as Record<string, unknown>;
    return row.consumedAt
      ? { ...payload, consumed: Math.floor(row.consumedAt.getTime() / 1000) }
      : payload;
  }
}
