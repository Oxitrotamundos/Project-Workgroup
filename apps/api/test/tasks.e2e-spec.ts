import request = require('supertest');
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthGuard } from '../src/auth/auth.guard';

describe('Tasks (e2e)', () => {
  let handle: E2EHandle;
  let prisma: PrismaService;
  let ownerId: bigint;
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
        firebaseUid: 'task-owner-uid',
        email: 'task-owner@example.com',
        displayName: 'Task Owner',
        role: 'admin',
      },
    });
    ownerId = owner.id;
    const project = await prisma.project.create({
      data: {
        name: 'Tasks Test Project',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'planning',
        ownerId,
        color: '#123456',
      },
    });
    projectId = project.id;
  }, 180_000);

  afterAll(() => handle.close());

  const taskPayload = (name: string) => ({
    name,
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    priority: 'medium',
    status: 'not-started',
    type: 'task',
    color: '#aabbcc',
  });

  it('creates three tasks with strictly increasing order', async () => {
    const r1 = await request(handle.app.getHttpServer())
      .post(`/v1/projects/${projectId}/tasks`)
      .set('Authorization', 'Bearer fake-token')
      .send(taskPayload('Task A'));
    expect(r1.status).toBe(201);

    const r2 = await request(handle.app.getHttpServer())
      .post(`/v1/projects/${projectId}/tasks`)
      .set('Authorization', 'Bearer fake-token')
      .send(taskPayload('Task B'));
    expect(r2.status).toBe(201);

    const r3 = await request(handle.app.getHttpServer())
      .post(`/v1/projects/${projectId}/tasks`)
      .set('Authorization', 'Bearer fake-token')
      .send(taskPayload('Task C'));
    expect(r3.status).toBe(201);

    expect(parseFloat(r1.body.order)).toBeLessThan(parseFloat(r2.body.order));
    expect(parseFloat(r2.body.order)).toBeLessThan(parseFloat(r3.body.order));
  });

  it('GET /v1/projects/:id/tasks → returns ordered task list', async () => {
    const res = await request(handle.app.getHttpServer())
      .get(`/v1/projects/${projectId}/tasks`)
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);
    expect(res.body[0].name).toBe('Task A');
    expect(res.body[1].name).toBe('Task B');
    expect(res.body[2].name).toBe('Task C');
  });

  it('reorders middle task to end using afterTaskId', async () => {
    const listRes = await request(handle.app.getHttpServer())
      .get(`/v1/projects/${projectId}/tasks`)
      .set('Authorization', 'Bearer fake-token');
    const tasks = listRes.body;
    const taskB = tasks.find((t: any) => t.name === 'Task B');
    const taskC = tasks.find((t: any) => t.name === 'Task C');

    const res = await request(handle.app.getHttpServer())
      .patch(`/v1/tasks/${taskB.id}/order`)
      .set('Authorization', 'Bearer fake-token')
      .send({ afterTaskId: taskC.id });
    expect(res.status).toBe(200);
    expect(parseFloat(res.body.order)).toBeGreaterThan(parseFloat(taskC.order));
  });

  it('PATCH /v1/tasks/:id/progress → updates progress', async () => {
    const listRes = await request(handle.app.getHttpServer())
      .get(`/v1/projects/${projectId}/tasks`)
      .set('Authorization', 'Bearer fake-token');
    const taskA = listRes.body.find((t: any) => t.name === 'Task A');

    const res = await request(handle.app.getHttpServer())
      .patch(`/v1/tasks/${taskA.id}/progress`)
      .set('Authorization', 'Bearer fake-token')
      .send({ progress: 50 });
    expect(res.status).toBe(200);
    expect(res.body.progress).toBe(50);
  });
});
