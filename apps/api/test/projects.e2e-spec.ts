import request from 'supertest';
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthGuard } from '../src/auth/auth.guard';

interface MockUser {
  id: bigint;
  role: 'admin' | 'pm' | 'member';
  firebaseUid: null;
  via: 'api_key';
}

describe('Projects (e2e)', () => {
  let handle: E2EHandle;
  let prisma: PrismaService;
  let ownerId: bigint;
  let viewerId: bigint;
  let managerId: bigint;
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
        firebaseUid: 'owner-uid',
        email: 'owner@example.com',
        displayName: 'Owner',
        role: 'admin',
      },
    });
    ownerId = owner.id;
    const viewer = await prisma.user.create({
      data: {
        firebaseUid: 'proj-viewer-uid',
        email: 'proj-viewer@example.com',
        displayName: 'Project Viewer',
        role: 'member',
      },
    });
    viewerId = viewer.id;
    const manager = await prisma.user.create({
      data: {
        firebaseUid: 'proj-manager-uid',
        email: 'proj-manager@example.com',
        displayName: 'Project Manager',
        role: 'member',
      },
    });
    managerId = manager.id;
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

  describe('projectRole enforcement on update/delete', () => {
    let scopedProjectId: bigint;

    beforeEach(async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Scoped Project',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'planning',
          ownerId,
          color: '#123456',
        },
      });
      scopedProjectId = project.id;
      await prisma.projectMember.create({
        data: {
          projectId: scopedProjectId,
          userId: viewerId,
          projectRole: 'viewer',
        },
      });
      await prisma.projectMember.create({
        data: {
          projectId: scopedProjectId,
          userId: managerId,
          projectRole: 'manager',
        },
      });
    });

    it('PATCH as viewer → 403', async () => {
      currentUser = {
        id: viewerId,
        role: 'member',
        firebaseUid: null,
        via: 'api_key',
      };
      const res = await request(handle.app.getHttpServer())
        .patch(`/v1/projects/${scopedProjectId}`)
        .set('Authorization', 'Bearer fake-token')
        .send({ name: 'Hijacked' });
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
        .delete(`/v1/projects/${scopedProjectId}`)
        .set('Authorization', 'Bearer fake-token');
      expect(res.status).toBe(403);

      const stillThere = await prisma.project.findUnique({
        where: { id: scopedProjectId },
      });
      expect(stillThere).not.toBeNull();
    });

    it('PATCH as manager → 200', async () => {
      currentUser = {
        id: managerId,
        role: 'member',
        firebaseUid: null,
        via: 'api_key',
      };
      const res = await request(handle.app.getHttpServer())
        .patch(`/v1/projects/${scopedProjectId}`)
        .set('Authorization', 'Bearer fake-token')
        .send({ name: 'Renamed by Manager' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed by Manager');
    });

    it('DELETE as manager → 204', async () => {
      currentUser = {
        id: managerId,
        role: 'member',
        firebaseUid: null,
        via: 'api_key',
      };
      const res = await request(handle.app.getHttpServer())
        .delete(`/v1/projects/${scopedProjectId}`)
        .set('Authorization', 'Bearer fake-token');
      expect(res.status).toBe(204);
    });
  });
});
