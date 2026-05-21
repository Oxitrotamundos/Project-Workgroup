import request = require('supertest');
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthGuard } from '../src/auth/auth.guard';

interface MockUser {
  id: bigint;
  role: 'admin' | 'pm' | 'member';
  firebaseUid: null;
  via: 'api_key';
}

describe('ProjectMembers (e2e)', () => {
  let handle: E2EHandle;
  let prisma: PrismaService;
  let ownerId: bigint;
  let memberId: bigint;
  let managerId: bigint;
  let viewerId: bigint;
  let candidateId: bigint;
  let projectId: bigint;
  let currentUser: MockUser;

  beforeAll(async () => {
    handle = await bootE2E({
      overrideGuard: {
        guard: AuthGuard,
        value: {
          canActivate: (ctx: any) => {
            const req = ctx.switchToHttp().getRequest();
            req.user = currentUser;
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
    const manager = await prisma.user.create({
      data: {
        firebaseUid: 'pm-manager-uid',
        email: 'pm-manager@example.com',
        displayName: 'PM Manager',
        role: 'member',
      },
    });
    managerId = manager.id;
    const viewer = await prisma.user.create({
      data: {
        firebaseUid: 'pm-viewer-uid',
        email: 'pm-viewer@example.com',
        displayName: 'PM Viewer',
        role: 'member',
      },
    });
    viewerId = viewer.id;
    const candidate = await prisma.user.create({
      data: {
        firebaseUid: 'pm-candidate-uid',
        email: 'pm-candidate@example.com',
        displayName: 'PM Candidate',
        role: 'member',
      },
    });
    candidateId = candidate.id;
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
    currentUser = {
      id: ownerId,
      role: 'admin',
      firebaseUid: null,
      via: 'api_key',
    };
  }, 180_000);

  afterAll(() => handle.close());

  beforeEach(() => {
    currentUser = {
      id: ownerId,
      role: 'admin',
      firebaseUid: null,
      via: 'api_key',
    };
  });

  it('POST /v1/projects/:id/members → 201 adds member (as admin)', async () => {
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
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.map((m: any) => m.userId)).toContain(memberId.toString());
  });

  it('POST duplicate add → 400', async () => {
    const res = await request(handle.app.getHttpServer())
      .post(`/v1/projects/${projectId}/members`)
      .set('Authorization', 'Bearer fake-token')
      .send({ userId: memberId.toString(), projectRole: 'contributor' });
    expect(res.status).toBe(400);
  });

  describe('projectRole enforcement', () => {
    beforeAll(async () => {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: managerId } },
        update: { projectRole: 'manager' },
        create: { projectId, userId: managerId, projectRole: 'manager' },
      });
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: viewerId } },
        update: { projectRole: 'viewer' },
        create: { projectId, userId: viewerId, projectRole: 'viewer' },
      });
    });

    it('POST as viewer → 403', async () => {
      currentUser = {
        id: viewerId,
        role: 'member',
        firebaseUid: null,
        via: 'api_key',
      };
      const res = await request(handle.app.getHttpServer())
        .post(`/v1/projects/${projectId}/members`)
        .set('Authorization', 'Bearer fake-token')
        .send({ userId: candidateId.toString(), projectRole: 'contributor' });
      expect(res.status).toBe(403);
    });

    it('DELETE as viewer → 403', async () => {
      currentUser = {
        id: viewerId,
        role: 'member',
        firebaseUid: null,
        via: 'api_key',
      };
      const res = await request(handle.app.getHttpServer())
        .delete(`/v1/projects/${projectId}/members/${memberId}`)
        .set('Authorization', 'Bearer fake-token');
      expect(res.status).toBe(403);
    });

    it('POST as manager → 201', async () => {
      currentUser = {
        id: managerId,
        role: 'member',
        firebaseUid: null,
        via: 'api_key',
      };
      const res = await request(handle.app.getHttpServer())
        .post(`/v1/projects/${projectId}/members`)
        .set('Authorization', 'Bearer fake-token')
        .send({ userId: candidateId.toString(), projectRole: 'contributor' });
      expect(res.status).toBe(201);
      expect(res.body.userId).toBe(candidateId.toString());
    });

    it('DELETE as manager → 204', async () => {
      currentUser = {
        id: managerId,
        role: 'member',
        firebaseUid: null,
        via: 'api_key',
      };
      const res = await request(handle.app.getHttpServer())
        .delete(`/v1/projects/${projectId}/members/${candidateId}`)
        .set('Authorization', 'Bearer fake-token');
      expect(res.status).toBe(204);
    });
  });

  it('DELETE /v1/projects/:id/members/:userId → 204 (as admin)', async () => {
    const res = await request(handle.app.getHttpServer())
      .delete(`/v1/projects/${projectId}/members/${memberId}`)
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(204);
  });
});
