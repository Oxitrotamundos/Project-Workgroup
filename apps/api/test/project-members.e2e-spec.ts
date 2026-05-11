import request = require('supertest');
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthGuard } from '../src/auth/auth.guard';

describe('ProjectMembers (e2e)', () => {
  let handle: E2EHandle;
  let prisma: PrismaService;
  let ownerId: bigint;
  let memberId: bigint;
  let projectId: bigint;

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
        firebaseUid: 'pm-owner-uid',
        email: 'pm-owner@example.com',
        displayName: 'PM Owner',
        role: 'admin',
      },
    });
    ownerId = owner.id;
    const member = await prisma.user.create({
      data: {
        firebaseUid: 'pm-member-uid',
        email: 'pm-member@example.com',
        displayName: 'PM Member',
        role: 'member',
      },
    });
    memberId = member.id;
    const project = await prisma.project.create({
      data: {
        name: 'Members Test Project',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'planning',
        ownerId,
        color: '#0000ff',
      },
    });
    projectId = project.id;
  }, 180_000);

  afterAll(() => handle.close());

  it('POST /v1/projects/:id/members → 201 adds member', async () => {
    const res = await request(handle.app.getHttpServer())
      .post(`/v1/projects/${projectId}/members`)
      .set('Authorization', 'Bearer fake-token')
      .send({ userId: memberId.toString(), projectRole: 'contributor' });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(memberId.toString());
    expect(res.body.projectRole).toBe('contributor');
  });

  it('GET /v1/projects/:id/members → lists members', async () => {
    const res = await request(handle.app.getHttpServer())
      .get(`/v1/projects/${projectId}/members`)
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].userId).toBe(memberId.toString());
  });

  it('POST duplicate add → 400', async () => {
    const res = await request(handle.app.getHttpServer())
      .post(`/v1/projects/${projectId}/members`)
      .set('Authorization', 'Bearer fake-token')
      .send({ userId: memberId.toString(), projectRole: 'contributor' });
    expect(res.status).toBe(400);
  });

  it('DELETE /v1/projects/:id/members/:userId → 204', async () => {
    const res = await request(handle.app.getHttpServer())
      .delete(`/v1/projects/${projectId}/members/${memberId}`)
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(204);
  });
});
