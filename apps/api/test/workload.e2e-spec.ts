import request = require('supertest');
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthGuard } from '../src/auth/auth.guard';

describe('Workload (e2e)', () => {
  let handle: E2EHandle;
  let prisma: PrismaService;
  let ownerId: bigint;
  let projectId: bigint;
  let taskId: bigint;

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
        firebaseUid: 'wl-owner-uid',
        email: 'wl-owner@example.com',
        displayName: 'WL Owner',
        role: 'admin',
      },
    });
    ownerId = owner.id;
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
  }, 180_000);

  afterAll(() => handle.close());

  it('POST /v1/projects/:id/workload → 201 creates workload entry', async () => {
    const res = await request(handle.app.getHttpServer())
      .post(`/v1/projects/${projectId}/workload`)
      .set('Authorization', 'Bearer fake-token')
      .send({
        userId: ownerId.toString(),
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
        userId: ownerId.toString(),
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
});
