import request from 'supertest';
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthGuard } from '../src/auth/auth.guard';

describe('ApiKeys (e2e)', () => {
  let handle: E2EHandle;
  let prisma: PrismaService;
  let userId: bigint;

  beforeAll(async () => {
    const capturedUserId: () => bigint = () => userId;
    handle = await bootE2E({
      overrideGuard: {
        guard: AuthGuard,
        value: {
          canActivate: (ctx: any) => {
            ctx.switchToHttp().getRequest().user = {
              id: capturedUserId(),
              firebaseUid: 'fb-x',
              role: 'member',
              via: 'firebase',
            };
            return true;
          },
        },
      },
    });
    prisma = handle.app.get(PrismaService);
    const u = await prisma.user.create({
      data: {
        firebaseUid: 'fb-x',
        email: 'x@y.z',
        displayName: 'X',
        role: 'member',
      },
    });
    userId = u.id;
  }, 180_000);

  afterAll(() => handle.close());

  it('creates, lists, and revokes api keys', async () => {
    const created = await request(handle.app.getHttpServer())
      .post('/v1/me/api-keys')
      .send({ name: 'primary' });
    expect(created.status).toBe(201);
    expect(created.body.plaintext).toMatch(/^pwg_/);
    expect(created.body.prefix).toHaveLength(8);
    expect(created.body.id).toBeDefined();

    const list = await request(handle.app.getHttpServer()).get(
      '/v1/me/api-keys',
    );
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).not.toHaveProperty('plaintext');
    expect(list.body[0].id).toBe(created.body.id);

    const del = await request(handle.app.getHttpServer()).delete(
      `/v1/me/api-keys/${created.body.id}`,
    );
    expect(del.status).toBe(204);

    const afterRevoke = await request(handle.app.getHttpServer()).get(
      '/v1/me/api-keys',
    );
    expect(afterRevoke.status).toBe(200);
    expect(afterRevoke.body).toHaveLength(0);
  });
});
