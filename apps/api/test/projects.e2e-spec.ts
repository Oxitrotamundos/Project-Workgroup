import request from 'supertest';
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthGuard } from '../src/auth/auth.guard';

describe('Projects (e2e)', () => {
  let handle: E2EHandle;
  let prisma: PrismaService;
  let ownerId: bigint;

  beforeAll(async () => {
    handle = await bootE2E({
      overrideGuard: {
        guard: AuthGuard,
        value: {
          canActivate: (ctx: any) => {
            const req = ctx.switchToHttp().getRequest();
            req.user = {
              id: ownerId,
              role: 'admin',
              firebaseUid: null,
              via: 'api_key',
            };
            return true;
          },
        },
      },
    });
    prisma = handle.app.get(PrismaService);
    const owner = await prisma.user.create({
      data: {
        firebaseUid: 'owner-uid',
        email: 'owner@example.com',
        displayName: 'Owner',
        role: 'admin',
      },
    });
    ownerId = owner.id;
  }, 180_000);

  afterAll(() => handle.close());

  it('POST /v1/projects → 201 with project payload', async () => {
    const res = await request(handle.app.getHttpServer())
      .post('/v1/projects')
      .set('Authorization', 'Bearer fake-token')
      .send({
        name: 'Test Project',
        description: 'A test',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'planning',
        color: '#ff0000',
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Project');
    expect(res.body.status).toBe('planning');
    expect(res.body.ownerId).toBe(ownerId.toString());
  });

  it('GET /v1/projects → includes created project', async () => {
    const res = await request(handle.app.getHttpServer())
      .get('/v1/projects')
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].name).toBe('Test Project');
  });
});
