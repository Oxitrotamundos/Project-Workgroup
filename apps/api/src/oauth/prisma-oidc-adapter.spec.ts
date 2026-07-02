import { PrismaOidcAdapter } from './prisma-oidc-adapter';

const makePrisma = () => ({
  oAuthPayload: {
    upsert: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
});

describe('PrismaOidcAdapter', () => {
  it('upsert stores the payload keyed by (type,id) with denormalized lookups + expiresAt', async () => {
    const prisma = makePrisma();
    const a = new PrismaOidcAdapter('AccessToken', prisma as any);
    await a.upsert('abc', { grantId: 'g1', accountId: '7' }, 3600);
    const arg = prisma.oAuthPayload.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ type_id: { type: 'AccessToken', id: 'abc' } });
    expect(arg.create).toMatchObject({
      type: 'AccessToken',
      id: 'abc',
      grantId: 'g1',
    });
    expect(arg.create.expiresAt).toBeInstanceOf(Date);
  });

  it('find returns undefined for a missing or expired row', async () => {
    const prisma = makePrisma();
    prisma.oAuthPayload.findUnique.mockResolvedValueOnce(null);
    const a = new PrismaOidcAdapter('Session', prisma as any);
    expect(await a.find('x')).toBeUndefined();
    prisma.oAuthPayload.findUnique.mockResolvedValueOnce({
      payload: { a: 1 },
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null,
    });
    expect(await a.find('x')).toBeUndefined();
  });

  it('find returns the payload with consumed epoch when consumed', async () => {
    const prisma = makePrisma();
    const consumedAt = new Date();
    prisma.oAuthPayload.findUnique.mockResolvedValueOnce({
      payload: { grantId: 'g' },
      expiresAt: null,
      consumedAt,
    });
    const a = new PrismaOidcAdapter('AuthorizationCode', prisma as any);
    const found = await a.find('c');
    expect(found).toMatchObject({
      grantId: 'g',
      consumed: Math.floor(consumedAt.getTime() / 1000),
    });
  });

  it('revokeByGrantId deletes all rows of the grant', async () => {
    const prisma = makePrisma();
    const a = new PrismaOidcAdapter('AccessToken', prisma as any);
    await a.revokeByGrantId('g1');
    expect(prisma.oAuthPayload.deleteMany).toHaveBeenCalledWith({
      where: { grantId: 'g1' },
    });
  });
});
