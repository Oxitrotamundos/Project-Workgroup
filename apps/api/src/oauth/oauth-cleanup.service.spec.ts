import { OAuthCleanupService } from './oauth-cleanup.service';

describe('OAuthCleanupService', () => {
  it('deletes rows whose expiresAt is in the past', async () => {
    const prisma = {
      oAuthPayload: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
    };
    const svc = new OAuthCleanupService(prisma as any);
    const n = await svc.prune();
    expect(n).toBe(3);
    const where = prisma.oAuthPayload.deleteMany.mock.calls[0][0].where;
    expect(where.expiresAt.lt).toBeInstanceOf(Date);
  });
});
