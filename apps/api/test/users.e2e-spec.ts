import request = require('supertest');
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Users (e2e)', () => {
  let handle: E2EHandle;
  let prisma: PrismaService;

  beforeAll(async () => {
    handle = await bootE2E();
    prisma = handle.app.get(PrismaService);
    await prisma.user.createMany({
      data: [
        {
          firebaseUid: 'uid-a',
          email: 'alice@example.com',
          displayName: 'Alice',
          role: 'member',
        },
        {
          firebaseUid: 'uid-b',
          email: 'bob@example.com',
          displayName: 'Bob',
          role: 'member',
        },
      ],
    });
  }, 180_000);

  afterAll(() => handle.close());

  it('rejects without auth header', async () => {
    const res = await request(handle.app.getHttpServer()).get('/v1/users');
    expect(res.status).toBe(401);
  });
});
