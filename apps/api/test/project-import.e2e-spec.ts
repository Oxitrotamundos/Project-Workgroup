import request from 'supertest';
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthGuard } from '../src/auth/auth.guard';

const validPlan = () => ({
  project: {
    name: 'KTP Q2',
    startDate: '2026-05-14',
    endDate: '2026-08-01',
    status: 'active',
    color: '#3b82f6',
  },
  tasks: [
    { ref: 'sec', name: 'Seguridad', type: 'summary', startDate: '2026-05-26', endDate: '2026-05-30', priority: 'high', status: 'completed', color: '#10b981' },
    { ref: 'sec-1', parentRef: 'sec', name: 'App Check', type: 'task', startDate: '2026-05-26', endDate: '2026-05-28', priority: 'high', status: 'completed', color: '#10b981', tags: ['security'] },
    { ref: 'h4', name: 'CMS inicial', type: 'milestone', startDate: '2026-06-26', priority: 'high', status: 'in-progress', color: '#f59e0b' },
  ],
  dependencies: [{ fromRef: 'sec-1', toRef: 'h4', type: 'e2s' }],
});

describe('POST /v1/projects/import (e2e)', () => {
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
            req.user = { id: ownerId, role: 'admin', firebaseUid: null, via: 'api_key' };
            return true;
          },
        },
      },
    });
    prisma = handle.app.get(PrismaService);
    const owner = await prisma.user.create({
      data: {
        firebaseUid: 'import-owner-uid',
        email: 'import-owner@example.com',
        displayName: 'Import Owner',
        role: 'admin',
      },
    });
    ownerId = owner.id;
  }, 180_000);

  afterAll(() => handle.close());

  it('creates project, tasks, hierarchy and dependency atomically', async () => {
    const res = await request(handle.app.getHttpServer())
      .post('/v1/projects/import')
      .set('Authorization', 'Bearer fake-token')
      .send(validPlan());
    expect(res.status).toBe(201);
    expect(res.body.taskCount).toBe(3);
    expect(res.body.dependencyCount).toBe(1);
    expect(Object.keys(res.body.taskRefToId)).toEqual(
      expect.arrayContaining(['sec', 'sec-1', 'h4']),
    );

    const projectId = res.body.project.id;
    const tasks = await request(handle.app.getHttpServer())
      .get(`/v1/projects/${projectId}/tasks`)
      .set('Authorization', 'Bearer fake-token');
    expect(tasks.status).toBe(200);
    expect(tasks.body).toHaveLength(3);

    const childId = res.body.taskRefToId['sec-1'];
    const parentId = res.body.taskRefToId['sec'];
    const child = tasks.body.find((t: { id: string }) => t.id === childId);
    expect(child.parentId).toBe(parentId);

    const links = await request(handle.app.getHttpServer())
      .get(`/v1/projects/${projectId}/task-links`)
      .set('Authorization', 'Bearer fake-token');
    expect(links.status).toBe(200);
    expect(links.body).toHaveLength(1);
  });

  it('rolls back everything when a dependency references an unknown task', async () => {
    const before = await request(handle.app.getHttpServer())
      .get('/v1/projects')
      .set('Authorization', 'Bearer fake-token');
    expect(before.status).toBe(200);

    const bad = validPlan();
    bad.dependencies = [{ fromRef: 'sec-1', toRef: 'ghost', type: 'e2s' }];

    await request(handle.app.getHttpServer())
      .post('/v1/projects/import')
      .set('Authorization', 'Bearer fake-token')
      .send(bad)
      .expect(400);

    const after = await request(handle.app.getHttpServer())
      .get('/v1/projects')
      .set('Authorization', 'Bearer fake-token');
    expect(after.status).toBe(200);
    // El proyecto NO debe haberse creado: el conteo es idéntico al previo.
    expect(after.body.length).toBe(before.body.length);
  });
});
