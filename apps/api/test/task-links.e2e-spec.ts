import request = require('supertest');
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthGuard } from '../src/auth/auth.guard';

describe('TaskLinks (e2e)', () => {
  let handle: E2EHandle;
  let prisma: PrismaService;
  let ownerId: bigint;
  let projectId: bigint;
  let taskAId: string;
  let taskBId: string;
  let taskCId: string;

  beforeAll(async () => {
    handle = await bootE2E({
      overrideGuard: {
        guard: AuthGuard,
        value: {
          canActivate: (ctx: any) => {
            const req = ctx.switchToHttp().getRequest();
            req.user = { id: ownerId, role: 'admin', firebaseUid: null, via: 'api_key' };
            return true;
          },
        },
      },
    });
    prisma = handle.app.get(PrismaService);
    const owner = await prisma.user.create({
      data: {
        firebaseUid: 'link-owner-uid',
        email: 'link-owner@example.com',
        displayName: 'Link Owner',
        role: 'admin',
      },
    });
    ownerId = owner.id;
    const project = await prisma.project.create({
      data: {
        name: 'Links Test Project',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'planning',
        ownerId,
        color: '#aabbcc',
      },
    });
    projectId = project.id;

    const makeTask = (name: string, order: string) =>
      prisma.task.create({
        data: {
          projectId,
          name,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          duration: '30',
          priority: 'medium',
          status: 'not_started',
          type: 'task',
          color: '#ffffff',
          order,
        },
      });

    const tA = await makeTask('Task A', '1000.000000000000000');
    const tB = await makeTask('Task B', '2000.000000000000000');
    const tC = await makeTask('Task C', '3000.000000000000000');
    taskAId = tA.id.toString();
    taskBId = tB.id.toString();
    taskCId = tC.id.toString();
  }, 180_000);

  afterAll(() => handle.close());

  it('POST /v1/projects/:id/task-links → 201 creates valid link', async () => {
    const res = await request(handle.app.getHttpServer())
      .post(`/v1/projects/${projectId}/task-links`)
      .set('Authorization', 'Bearer fake-token')
      .send({ sourceTaskId: taskAId, targetTaskId: taskBId, type: 'e2s' });
    expect(res.status).toBe(201);
    expect(res.body.sourceTaskId).toBe(taskAId);
    expect(res.body.targetTaskId).toBe(taskBId);
    expect(res.body.type).toBe('e2s');
  });

  it('POST duplicate link → 409', async () => {
    const res = await request(handle.app.getHttpServer())
      .post(`/v1/projects/${projectId}/task-links`)
      .set('Authorization', 'Bearer fake-token')
      .send({ sourceTaskId: taskAId, targetTaskId: taskBId, type: 'e2s' });
    expect(res.status).toBe(409);
  });

  it('POST cycle link → 409', async () => {
    const res = await request(handle.app.getHttpServer())
      .post(`/v1/projects/${projectId}/task-links`)
      .set('Authorization', 'Bearer fake-token')
      .send({ sourceTaskId: taskBId, targetTaskId: taskAId, type: 'e2s' });
    expect(res.status).toBe(409);
  });

  it('POST valid non-cyclic link B→C → 201', async () => {
    const res = await request(handle.app.getHttpServer())
      .post(`/v1/projects/${projectId}/task-links`)
      .set('Authorization', 'Bearer fake-token')
      .send({ sourceTaskId: taskBId, targetTaskId: taskCId, type: 'e2s' });
    expect(res.status).toBe(201);
  });

  it('DELETE /v1/task-links/:id → 204', async () => {
    const listRes = await request(handle.app.getHttpServer())
      .get(`/v1/projects/${projectId}/task-links`)
      .set('Authorization', 'Bearer fake-token');
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBeGreaterThan(0);
    const linkId = listRes.body[0].id;

    const res = await request(handle.app.getHttpServer())
      .delete(`/v1/task-links/${linkId}`)
      .set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(204);
  });
});
