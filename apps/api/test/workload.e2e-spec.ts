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

describe('Workload (e2e)', () => {
  let handle: E2EHandle;
  let prisma: PrismaService;
  let ownerId: bigint;
  let outsiderId: bigint;
  let projectId: bigint;
  let taskId: bigint;
  let resourceId: bigint;
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
        firebaseUid: 'wl-owner-uid',
        email: 'wl-owner@example.com',
        displayName: 'WL Owner',
        role: 'admin',
      },
    });
    ownerId = owner.id;
    // El workload apunta a un resource, no a un user: creamos el resource enlazado del owner.
    const resource = await prisma.resource.create({
      data: { name: 'WL Owner', kind: 'user', userId: ownerId },
    });
    resourceId = resource.id;
    const outsider = await prisma.user.create({
      data: {
        firebaseUid: 'wl-outsider-uid',
        email: 'wl-outsider@example.com',
        displayName: 'WL Outsider',
        role: 'member',
      },
    });
    outsiderId = outsider.id;
    const project = await prisma.project.create({
      data: {
        name: 'Workload Test Project',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'planning',
        ownerId,
        color: '#abcdef',
      },
    });
    projectId = project.id;
    const task = await prisma.task.create({
      data: {
        projectId,
        name: 'WL Task',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        duration: '30',
        priority: 'medium',
        status: 'not_started',
        type: 'task',
        color: '#ffffff',
        order: '1000.000000000000000',
      },
    });
    taskId = task.id;
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

  it('POST /v1/projects/:id/workload → 201 creates workload entry', async () => {
    const res = await request(handle.app.getHttpServer())
      .post(`/v1/projects/${projectId}/workload`)
      .set('Authorization', 'Bearer fake-token')
      .send({
        resourceId: resourceId.toString(),
        taskId: taskId.toString(),
        date: '2026-01-15',
        allocatedHours: '8',
      });
    expect(res.status).toBe(201);
    expect(res.body.allocatedHours).toBe('8');
    expect(res.body.date).toBe('2026-01-15');
  });

  it('GET /v1/projects/:id/workload?dateFrom=&dateTo= → filters by date range', async () => {
    await request(handle.app.getHttpServer())
      .post(`/v1/projects/${projectId}/workload`)
      .set('Authorization', 'Bearer fake-token')
      .send({
        resourceId: resourceId.toString(),
        taskId: taskId.toString(),
        date: '2026-02-10',
        allocatedHours: '4',
      });

    const res = await request(handle.app.getHttpServer())
      .get(`/v1/projects/${projectId}/workload`)
      .set('Authorization', 'Bearer fake-token')
      .query({ dateFrom: '2026-01-01', dateTo: '2026-01-31' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].date).toBe('2026-01-15');
  });

  it('DELETE /v1/workload/:id → 403 when caller is not a project member', async () => {
    const created = await prisma.workload.create({
      data: {
        resourceId: resourceId,
        taskId,
        projectId,
        date: new Date('2026-03-01'),
        allocatedHours: '4',
      },
    });

    currentUser = {
      id: outsiderId,
      role: 'member',
      firebaseUid: null,
      via: 'api_key',
    };

    const res = await request(handle.app.getHttpServer())
      .delete(`/v1/workload/${created.id}`)
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(403);

    const stillThere = await prisma.workload.findUnique({
      where: { id: created.id },
    });
    expect(stillThere).not.toBeNull();
  });

  it('DELETE /v1/workload/:id → 204 when caller is project owner', async () => {
    const created = await prisma.workload.create({
      data: {
        resourceId: resourceId,
        taskId,
        projectId,
        date: new Date('2026-04-01'),
        allocatedHours: '4',
      },
    });

    const res = await request(handle.app.getHttpServer())
      .delete(`/v1/workload/${created.id}`)
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(204);

    const removed = await prisma.workload.findUnique({
      where: { id: created.id },
    });
    expect(removed).toBeNull();
  });
});
