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

describe('Resources (e2e)', () => {
  let handle: E2EHandle;
  let prisma: PrismaService;
  let ownerId: bigint;
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
        firebaseUid: 'res-owner-uid',
        email: 'res-owner@example.com',
        displayName: 'Resources Owner',
        role: 'admin',
      },
    });
    ownerId = owner.id;
    const project = await prisma.project.create({
      data: {
        name: 'Resources Test Project',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'planning',
        ownerId,
        color: '#abcdef',
      },
    });
    projectId = project.id;
  }, 180_000);

  afterAll(() => handle.close());

  beforeEach(() => {
    // Por defecto cada test corre como admin; los tests de gating lo bajan a member.
    currentUser = {
      id: ownerId,
      role: 'admin',
      firebaseUid: null,
      via: 'api_key',
    };
  });

  // Helper para crear tareas con todos los campos requeridos por el schema (ver workload.e2e-spec.ts).
  let taskCounter = 0;
  const createTask = (opts: { assigneeId?: bigint }) => {
    taskCounter += 1;
    return prisma.task.create({
      data: {
        projectId,
        name: `Res Task ${taskCounter}`,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        duration: '30',
        priority: 'medium',
        status: 'not_started',
        type: 'task',
        color: '#ffffff',
        order: `${1000 + taskCounter}.000000000000000`,
        assigneeId: opts.assigneeId,
      },
    });
  };

  describe('gating', () => {
    it('POST /v1/resources → 403 when caller is member', async () => {
      currentUser = {
        id: ownerId,
        role: 'member',
        firebaseUid: null,
        via: 'api_key',
      };
      const res = await request(handle.app.getHttpServer())
        .post('/v1/resources')
        .set('Authorization', 'Bearer fake-token')
        .send({ name: 'Should Not Create' });
      expect(res.status).toBe(403);
    });

    it('POST /v1/resources → 201 when caller is admin and creates a placeholder', async () => {
      const res = await request(handle.app.getHttpServer())
        .post('/v1/resources')
        .set('Authorization', 'Bearer fake-token')
        .send({ name: 'Admin Created' });
      expect(res.status).toBe(201);
      expect(res.body.kind).toBe('placeholder');
      expect(res.body.name).toBe('Admin Created');
    });
  });

  describe('list', () => {
    it('GET /v1/resources → 200 for any authenticated user (member included)', async () => {
      currentUser = {
        id: ownerId,
        role: 'member',
        firebaseUid: null,
        via: 'api_key',
      };
      const res = await request(handle.app.getHttpServer())
        .get('/v1/resources')
        .set('Authorization', 'Bearer fake-token');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
    });
  });

  describe('create', () => {
    it('forces kind=placeholder even though the DTO has no kind field', async () => {
      // CreateResourceDto no expone "kind"; el service lo fuerza siempre a placeholder
      // (el forbidNonWhitelisted global rechazaría con 400 si intentáramos colarlo).
      const res = await request(handle.app.getHttpServer())
        .post('/v1/resources')
        .set('Authorization', 'Bearer fake-token')
        .send({ name: 'Placeholder Only', discipline: 'QA' });
      expect(res.status).toBe(201);
      expect(res.body.kind).toBe('placeholder');
      expect(res.body.discipline).toBe('QA');
    });
  });

  describe('update', () => {
    it('PATCH /v1/resources/:id → 200 updates discipline/status of a placeholder', async () => {
      const created = await prisma.resource.create({
        data: { name: 'To Update', kind: 'placeholder' },
      });

      const res = await request(handle.app.getHttpServer())
        .patch(`/v1/resources/${created.id}`)
        .set('Authorization', 'Bearer fake-token')
        .send({ discipline: 'Backend', status: 'inactive' });

      expect(res.status).toBe(200);
      expect(res.body.discipline).toBe('Backend');
      expect(res.body.status).toBe('inactive');
    });
  });

  describe('linkToUser', () => {
    it('merges the user-linked resource into the placeholder and reassigns its work', async () => {
      const linkUser = await prisma.user.create({
        data: {
          firebaseUid: 'res-link-uid',
          email: 'res-link@example.com',
          displayName: 'Link User',
          role: 'member',
        },
      });
      // Simula la invariante de auth.sync: todo user real trae su resource auto-generado.
      const userResource = await prisma.resource.create({
        data: { name: 'Link User', kind: 'user', userId: linkUser.id },
      });
      const task = await createTask({ assigneeId: userResource.id });

      const placeholder = await prisma.resource.create({
        data: { name: 'Placeholder To Link', kind: 'placeholder' },
      });

      const res = await request(handle.app.getHttpServer())
        .patch(`/v1/resources/${placeholder.id}/link-user`)
        .set('Authorization', 'Bearer fake-token')
        .send({ userId: linkUser.id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.kind).toBe('user');
      expect(res.body.userId).toBe(linkUser.id.toString());

      const updatedTask = await prisma.task.findUnique({
        where: { id: task.id },
      });
      expect(updatedTask?.assigneeId).toBe(placeholder.id);

      const orphanResource = await prisma.resource.findUnique({
        where: { id: userResource.id },
      });
      expect(orphanResource).toBeNull();
    });

    it('PATCH .../link-user → 400 when target resource is already kind=user', async () => {
      const linkUser = await prisma.user.create({
        data: {
          firebaseUid: 'res-link-uid-2',
          email: 'res-link-2@example.com',
          displayName: 'Link User 2',
          role: 'member',
        },
      });
      const userResource = await prisma.resource.create({
        data: { name: 'Link User 2', kind: 'user', userId: linkUser.id },
      });

      const anotherUser = await prisma.user.create({
        data: {
          firebaseUid: 'res-link-uid-3',
          email: 'res-link-3@example.com',
          displayName: 'Another User',
          role: 'member',
        },
      });

      const res = await request(handle.app.getHttpServer())
        .patch(`/v1/resources/${userResource.id}/link-user`)
        .set('Authorization', 'Bearer fake-token')
        .send({ userId: anotherUser.id.toString() });

      expect(res.status).toBe(400);
    });
  });

  describe('remove', () => {
    it('DELETE /v1/resources/:id → 204 for a placeholder without references', async () => {
      const created = await prisma.resource.create({
        data: { name: 'To Delete', kind: 'placeholder' },
      });

      const res = await request(handle.app.getHttpServer())
        .delete(`/v1/resources/${created.id}`)
        .set('Authorization', 'Bearer fake-token');

      expect(res.status).toBe(204);

      const removed = await prisma.resource.findUnique({
        where: { id: created.id },
      });
      expect(removed).toBeNull();
    });

    it('DELETE /v1/resources/:id → 400 for a kind=user resource', async () => {
      const linkUser = await prisma.user.create({
        data: {
          firebaseUid: 'res-del-uid',
          email: 'res-del@example.com',
          displayName: 'Del User',
          role: 'member',
        },
      });
      const userResource = await prisma.resource.create({
        data: { name: 'Del User', kind: 'user', userId: linkUser.id },
      });

      const res = await request(handle.app.getHttpServer())
        .delete(`/v1/resources/${userResource.id}`)
        .set('Authorization', 'Bearer fake-token');

      expect(res.status).toBe(400);
    });

    it('DELETE /v1/resources/:id → 409 for a placeholder with an assigned task', async () => {
      const placeholder = await prisma.resource.create({
        data: { name: 'Busy Placeholder', kind: 'placeholder' },
      });
      await createTask({ assigneeId: placeholder.id });

      const res = await request(handle.app.getHttpServer())
        .delete(`/v1/resources/${placeholder.id}`)
        .set('Authorization', 'Bearer fake-token');

      expect(res.status).toBe(409);
    });
  });
});
