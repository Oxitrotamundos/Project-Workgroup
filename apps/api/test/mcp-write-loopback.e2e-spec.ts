import request from 'supertest';
import {
  generateKeyPair,
  exportJWK,
  calculateJwkThumbprint,
  SignJWT,
  type JWK,
  type KeyLike,
} from 'jose';
import { json } from 'express';
import { bootE2E, E2EHandle } from './e2e-setup';
import { createOidcProvider } from '../src/oauth/oidc-provider.factory';
import { mountOidcDiscoveryAliases } from '../src/oauth/oidc-discovery-aliases';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApiClient } from '@project-workgroup/mcp';
import type { AddressInfo } from 'node:net';

// Reproduce la condición de PROD: el Authorization Server montado en el Express crudo
// (como en main.ts). El bug del smoke: las lecturas /v1 funcionan pero las ESCRITURAS /v1 con
// body fallan (400 genérico) o no persisten. La e2e del AS solo probaba un GET; esto prueba writes.
const ISS = 'http://127.0.0.1/oauth';
const AUD = 'https://rs.test';

describe('MCP write loopback with the AS mounted (e2e repro)', () => {
  let handle: E2EHandle;
  let privateKey: KeyLike;
  let signKid: string;
  let userId: string;
  let projectId: string;
  let taskId: string;

  beforeAll(async () => {
    const kp = await generateKeyPair('RS256');
    privateKey = kp.privateKey;
    const pub: JWK = await exportJWK(kp.publicKey);
    const priv: JWK = await exportJWK(kp.privateKey);
    const kid = await calculateJwkThumbprint(pub);
    signKid = kid;
    pub.kid = priv.kid = kid;
    pub.alg = priv.alg = 'RS256';
    pub.use = priv.use = 'sig';
    process.env.MCP_OAUTH_ISSUER = ISS;
    process.env.MCP_OAUTH_AUDIENCE = AUD;
    process.env.MCP_OAUTH_SIGNING_JWKS = JSON.stringify({ keys: [priv] });
    process.env.MCP_OAUTH_JWKS = JSON.stringify({ keys: [pub] });

    handle = await bootE2E({
      // Replica el mount del AS de main.ts ANTES de app.init() (condición de prod).
      preInit: async (app) => {
        const provider = await createOidcProvider({
          issuer: ISS,
          audience: AUD,
          prisma: app.get(PrismaService),
          signingJwks: JSON.parse(process.env.MCP_OAUTH_SIGNING_JWKS as string),
          cookieKeys: ['test-cookie-key'],
          accessTokenTTL: 900,
          includeTestClient: true,
          allowedClientHosts: ['claude.ai', 'claude.com'],
        });
        const expressApp = app.getHttpAdapter().getInstance();
        // FIX (espejo de main.ts): parser JSON global explícito ANTES de los mounts del AS. Sin esto,
        // el express.json() que registra mountOidcInteractions hace que NestJS omita su body-parser
        // global (isMiddlewareApplied) y /v1 se queda sin req.body (escrituras rotas: 200 no-op / 400).
        expressApp.use(json());
        // Dispara la condición del AS: mountOidcInteractions registra su propio json en /oauth/interaction.
        expressApp.use('/oauth/interaction', json());
        mountOidcDiscoveryAliases(expressApp);
        expressApp.use('/oauth', provider.callback());
      },
    });

    const prisma = handle.app.get(PrismaService);
    const user = await prisma.user.create({
      data: {
        firebaseUid: 'mcp-write-e2e',
        email: 'mcpwrite@e2e.test',
        displayName: 'MCP Write E2E',
        role: 'pm',
      },
    });
    userId = user.id.toString();
    const project = await prisma.project.create({
      data: {
        name: 'Write Repro',
        ownerId: user.id,
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-31'),
        status: 'planning',
        color: '#64748b',
      },
    });
    projectId = project.id.toString();
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        name: 'Repro T1',
        type: 'task',
        status: 'not_started',
        priority: 'medium',
        progress: 0,
        startDate: new Date('2026-07-10'),
        endDate: new Date('2026-07-12'),
        duration: 2,
        order: '1',
        color: '#64748b',
      },
    });
    taskId = task.id.toString();
  }, 180_000);

  afterAll(async () => {
    try {
      await handle.close();
    } finally {
      for (const k of [
        'MCP_OAUTH_ISSUER',
        'MCP_OAUTH_AUDIENCE',
        'MCP_OAUTH_SIGNING_JWKS',
        'MCP_OAUTH_JWKS',
      ]) {
        delete process.env[k];
      }
    }
  });

  const mint = () =>
    new SignJWT({ scope: 'mcp:read mcp:write' })
      .setProtectedHeader({ alg: 'RS256', kid: signKid })
      .setSubject(userId)
      .setIssuer(ISS)
      .setAudience(AUD)
      .setExpirationTime('1h')
      .sign(privateKey);

  it('READ /v1/tasks/:id works with the oauth token (baseline)', async () => {
    const token = await mint();
    const res = await request(handle.app.getHttpServer())
      .get(`/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.id).toBe(taskId);
    expect(res.body.progress).toBe(0);
  });

  it('WRITE POST /v1/projects/:id/tasks persists (create_task path)', async () => {
    const token = await mint();
    const res = await request(handle.app.getHttpServer())
      .post(`/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'Created via loopback',
        startDate: '2026-07-15',
        endDate: '2026-07-16',
        type: 'task',
        priority: 'medium',
        status: 'not-started',
        color: '#64748b',
      });
    expect(res.status).toBe(201);
  });

  it('WRITE PATCH /v1/tasks/:id persists progress (update_task path)', async () => {
    const token = await mint();
    const current = await request(handle.app.getHttpServer())
      .get(`/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const res = await request(handle.app.getHttpServer())
      .patch(`/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ progress: 42, expectedVersion: current.body.version });
    expect(res.status).toBe(200);
    const after = await request(handle.app.getHttpServer())
      .get(`/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(after.body.progress).toBe(42);
  });

  // El path REAL de prod: el apiClient del MCP hace fetch loopback con body (no supertest).
  it('REAL apiClient loopback create + update persist', async () => {
    const token = await mint();
    const server = handle.app.getHttpServer();
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve()),
    );
    const port = (server.address() as AddressInfo).port;
    const client = createApiClient({
      baseUrl: `http://127.0.0.1:${port}`,
      apiKey: token,
    });

    const created = await client.createTask(projectId, {
      name: 'Created via REAL apiClient loopback',
      startDate: '2026-07-20',
      endDate: '2026-07-21',
      type: 'task',
      priority: 'medium',
      status: 'not-started',
      color: '#64748b',
    });
    expect(created.id).toBeTruthy();

    const cur = await client.getTask(taskId);
    await client.updateTask(taskId, {
      progress: 77,
      expectedVersion: cur.version,
    });
    const after = await client.getTask(taskId);
    expect(after.progress).toBe(77);

    // daily_update path: bulk atómico con version check.
    const cur2 = await client.getTask(taskId);
    await client.bulkUpdateTasks(projectId, [
      { id: taskId, data: { progress: 55 }, expectedVersion: cur2.version },
    ]);
    const after2 = await client.getTask(taskId);
    expect(after2.progress).toBe(55);
  });
});
