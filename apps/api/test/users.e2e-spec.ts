import request from 'supertest';
import { UnauthorizedException } from '@nestjs/common';
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthGuard } from '../src/auth/auth.guard';

interface MockUser {
  id: bigint;
  role: 'admin' | 'pm' | 'member';
  firebaseUid: null;
  via: 'api_key';
}

describe('Users (e2e)', () => {
  let handle: E2EHandle;
  let prisma: PrismaService;
  let currentUser: MockUser;

  beforeAll(async () => {
    handle = await bootE2E({
      overrideGuard: {
        guard: AuthGuard,
        value: {
          canActivate: (ctx: any) => {
            const req = ctx.switchToHttp().getRequest();
            if (!req.headers.authorization) {
              throw new UnauthorizedException();
            }
            req.user = currentUser;
            return true;
          },
        },
      },
    });
    prisma = handle.app.get(PrismaService);
    const alice = await prisma.user.create({
      data: {
        firebaseUid: 'uid-a',
        email: 'alice@example.com',
        displayName: 'Alice',
        role: 'member',
      },
    });
    await prisma.user.createMany({
      data: [
        {
          firebaseUid: 'uid-b',
          email: 'bob@example.com',
          displayName: 'Bob',
          role: 'member',
        },
        {
          firebaseUid: 'uid-c',
          email: 'carol@example.com',
          displayName: 'Carol Anderson',
          role: 'member',
        },
      ],
    });
    currentUser = {
      id: alice.id,
      role: 'admin',
      firebaseUid: null,
      via: 'api_key',
    };
  }, 180_000);

  afterAll(() => handle.close());

  it('rejects without auth header', async () => {
    const res = await request(handle.app.getHttpServer()).get('/v1/users');
    expect(res.status).toBe(401);
  });

  it('coerces the limit query param and returns matches', async () => {
    const res = await request(handle.app.getHttpServer())
      .get('/v1/users?search=a&limit=5')
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeLessThanOrEqual(5);
  });
});
