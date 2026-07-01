import request from 'supertest';
import { generateKeyPair, exportJWK, SignJWT, type KeyLike } from 'jose';
import { bootE2E, E2EHandle } from './e2e-setup';
import { PrismaService } from '../src/prisma/prisma.service';

const ISS = 'https://as.test';
const AUD = 'https://rs.test';

describe('OAuth Resource Server (e2e)', () => {
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
        firebaseUid: 'oauth-e2e',
        email: 'oauth@e2e.test',
        displayName: 'OAuth E2E',
        role: 'member',
      },
    });
    userId = user.id.toString();
  }, 180_000);

  afterAll(async () => {
    await handle.close();
    delete process.env.MCP_OAUTH_JWKS;
    delete process.env.MCP_OAUTH_ISSUER;
    delete process.env.MCP_OAUTH_AUDIENCE;
  });

  const mint = (over: Record<string, unknown> = {}) =>
    new SignJWT({ scope: 'mcp:read mcp:write', ...over })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setSubject(userId)
      .setIssuer(ISS)
      .setAudience(AUD)
      .setExpirationTime('1h')
      .sign(privateKey);

  it('accepts an mcp oauth token on a read endpoint', async () => {
    const token = await mint();
    await request(handle.app.getHttpServer())
      .get('/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('rejects DELETE for an mcp oauth token (403)', async () => {
    const token = await mint();
    await request(handle.app.getHttpServer())
      .delete('/v1/tasks/999999999')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('returns 401 with WWW-Authenticate when no token is present', async () => {
    const res = await request(handle.app.getHttpServer())
      .get('/v1/projects')
      .expect(401);
    expect(res.headers['www-authenticate']).toContain('resource_metadata=');
  });

  it('serves the protected resource metadata', async () => {
    const res = await request(handle.app.getHttpServer())
      .get('/.well-known/oauth-protected-resource')
      .expect(200);
    expect(res.body).toEqual({ resource: AUD, authorization_servers: [ISS] });
  });
});
