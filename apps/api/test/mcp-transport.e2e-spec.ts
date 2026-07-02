import request from 'supertest';
import { generateKeyPair, exportJWK, SignJWT, type KeyLike } from 'jose';
import { SERVER_NAME } from '@project-workgroup/mcp';
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';

const ISS = 'https://as.test';
const AUD = 'https://rs.test';

describe('MCP Streamable HTTP transport (e2e)', () => {
  let handle: E2EHandle;
  let privateKey: KeyLike;
  let userId: string;

  beforeAll(async () => {
    // Keypair de prueba: la pública va al env (JWKS) ANTES de arrancar la app; la privada mintea tokens.
    const kp = await generateKeyPair('RS256');
    privateKey = kp.privateKey;
    const jwk = await exportJWK(kp.publicKey);
    jwk.kid = 'test';
    jwk.alg = 'RS256';
    jwk.use = 'sig';
    process.env.MCP_OAUTH_JWKS = JSON.stringify({ keys: [jwk] });
    process.env.MCP_OAUTH_ISSUER = ISS;
    process.env.MCP_OAUTH_AUDIENCE = AUD;

    // AuthGuard real (sin overrideGuard): el guard corre de verdad.
    handle = await bootE2E();
    // Sembrar un usuario cuyo id será el `sub` del token.
    const prisma = handle.app.get(PrismaService);
    const user = await prisma.user.create({
      data: {
        firebaseUid: 'mcp-e2e',
        email: 'mcp@e2e.test',
        displayName: 'MCP E2E',
        role: 'member',
      },
    });
    userId = user.id.toString();
  }, 180_000);

  afterAll(async () => {
    // finally garantiza el cleanup de env vars incluso si close() lanza (evita fugas entre archivos de test).
    try {
      await handle.close();
    } finally {
      delete process.env.MCP_OAUTH_JWKS;
      delete process.env.MCP_OAUTH_ISSUER;
      delete process.env.MCP_OAUTH_AUDIENCE;
    }
  });

  const mint = () =>
    new SignJWT({ scope: 'mcp:read mcp:write' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setSubject(userId)
      .setIssuer(ISS)
      .setAudience(AUD)
      .setExpirationTime('1h')
      .sign(privateKey);

  it('returns 401 with WWW-Authenticate when no token is present', async () => {
    const res = await request(handle.app.getHttpServer())
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 1, method: 'ping' })
      .expect(401);
    expect(res.headers['www-authenticate']).toContain('resource_metadata=');
  });

  it('responds to the MCP initialize handshake with a valid token', async () => {
    const token = await mint();
    const res = await request(handle.app.getHttpServer())
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'e2e', version: '0.0.0' },
        },
      })
      .expect(200);

    // El transporte responde como SSE (enableJsonResponse=false): el mensaje JSON-RPC va en una línea `data:`.
    const dataLine = res.text
      .split('\n')
      .find((line) => line.startsWith('data:'));
    expect(dataLine).toBeDefined();
    const parsed = JSON.parse(dataLine!.slice('data:'.length).trim());
    expect(parsed.result).toBeDefined();
    expect(parsed.result.serverInfo.name).toBe(SERVER_NAME);
    expect(parsed.result.capabilities).toBeDefined();
  });
});
