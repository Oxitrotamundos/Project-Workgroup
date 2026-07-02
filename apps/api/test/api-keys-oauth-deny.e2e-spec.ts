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
import { ApiKeysService } from '../src/api-keys/api-keys.service';

// Fix #2: un token via:'oauth' no debe poder acuñar (ni listar/revocar) API keys.
// El AS se monta igual que en mcp-write-loopback.e2e-spec.ts para reproducir la condición de prod
// (json body parser + rutas del AS montadas antes de app.init()).
const ISS = 'http://127.0.0.1/oauth';
const AUD = 'https://rs.test';

describe('ApiKeys deny oauth (e2e)', () => {
  let handle: E2EHandle;
  let privateKey: KeyLike;
  let signKid: string;
  let userId: string;

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
        expressApp.use(json());
        expressApp.use('/oauth/interaction', json());
        mountOidcDiscoveryAliases(expressApp);
        expressApp.use('/oauth', provider.callback());
      },
    });

    const prisma = handle.app.get(PrismaService);
    const user = await prisma.user.create({
      data: {
        firebaseUid: 'apikeys-oauth-deny-e2e',
        email: 'apikeys-deny@e2e.test',
        displayName: 'ApiKeys Deny E2E',
        role: 'pm',
      },
    });
    userId = user.id.toString();
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

  const mintOAuthToken = () =>
    new SignJWT({ scope: 'mcp:read mcp:write' })
      .setProtectedHeader({ alg: 'RS256', kid: signKid })
      .setSubject(userId)
      .setIssuer(ISS)
      .setAudience(AUD)
      .setExpirationTime('1h')
      .sign(privateKey);

  it('rejects POST /v1/me/api-keys for an oauth token (403) and creates no key', async () => {
    const token = await mintOAuthToken();
    const res = await request(handle.app.getHttpServer())
      .post('/v1/me/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ name: 'mcp-minted' });
    expect(res.status).toBe(403);

    const prisma = handle.app.get(PrismaService);
    const keys = await prisma.apiKey.findMany({
      where: { userId: BigInt(userId) },
    });
    expect(keys).toHaveLength(0);
  });

  it('rejects GET /v1/me/api-keys for an oauth token (403)', async () => {
    const token = await mintOAuthToken();
    const res = await request(handle.app.getHttpServer())
      .get('/v1/me/api-keys')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects DELETE /v1/me/api-keys/:id for an oauth token (403, complementary to the existing AuthGuard block)', async () => {
    const token = await mintOAuthToken();
    const res = await request(handle.app.getHttpServer())
      .delete('/v1/me/api-keys/1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('allows POST /v1/me/api-keys with a legitimate api_key credential (regression, real AuthGuard)', async () => {
    const apiKeys = handle.app.get(ApiKeysService);
    const seed = await apiKeys.create(BigInt(userId), { name: 'seed' });

    const res = await request(handle.app.getHttpServer())
      .post('/v1/me/api-keys')
      .set('Authorization', `Bearer ${seed.plaintext}`)
      .set('Content-Type', 'application/json')
      .send({ name: 'via-api-key' });
    expect(res.status).toBe(201);
    expect(res.body.plaintext).toMatch(/^pwg_/);
  });
});
