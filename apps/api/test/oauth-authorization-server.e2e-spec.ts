import request from 'supertest';
import {
  generateKeyPair,
  exportJWK,
  calculateJwkThumbprint,
  decodeJwt,
  type JWK,
} from 'jose';
import { createHash, randomBytes } from 'node:crypto';
import { bootE2E, E2EHandle } from './e2e-setup';
import { createOidcProvider } from '../src/oauth/oidc-provider.factory';
import { PrismaService } from '../src/prisma/prisma.service';

// Issuer del AS montado en el harness: su pathname (/oauth) coincide con el mount de Express, y su
// valor es el `iss` que 4a exige. AUD es el resource server (mismo par que MCP_OAUTH_JWKS de 4a).
const ISS = 'http://127.0.0.1/oauth';
const AUD = 'https://rs.test';
const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';
const b64url = (b: Buffer) => b.toString('base64url');

describe('OAuth Authorization Server (e2e)', () => {
  let handle: E2EHandle;
  // El stub de interacción lee este id en tiempo de request; se rellena tras sembrar el usuario.
  let stubAccountId = '';

  beforeAll(async () => {
    // Un solo par RS256: la privada firma en el AS (SIGNING_JWKS), la pública la verifica 4a (JWKS).
    const kp = await generateKeyPair('RS256');
    const pubJwk: JWK = await exportJWK(kp.publicKey);
    const privJwk: JWK = await exportJWK(kp.privateKey);
    const kid = await calculateJwkThumbprint(pubJwk);
    pubJwk.kid = privJwk.kid = kid;
    pubJwk.alg = privJwk.alg = 'RS256';
    pubJwk.use = privJwk.use = 'sig';
    process.env.MCP_OAUTH_ISSUER = ISS;
    process.env.MCP_OAUTH_AUDIENCE = AUD;
    process.env.MCP_OAUTH_SIGNING_JWKS = JSON.stringify({ keys: [privJwk] });
    process.env.MCP_OAUTH_JWKS = JSON.stringify({ keys: [pubJwk] });

    handle = await bootE2E({
      // bootE2E no arranca main.ts, así que replicamos el mount del provider (Task 2) ANTES de
      // app.init() para que Express lo vea antes que el router de Nest. El stub de interacción es
      // SOLO de test (auto-login); nunca va a producción (4b-ii añade el login Firebase real).
      preInit: async (app) => {
        const provider = await createOidcProvider({
          issuer: process.env.MCP_OAUTH_ISSUER as string,
          audience: process.env.MCP_OAUTH_AUDIENCE as string,
          prisma: app.get(PrismaService),
          signingJwks: JSON.parse(process.env.MCP_OAUTH_SIGNING_JWKS as string),
        });
        const expressApp = app.getHttpAdapter().getInstance();

        // Stub de interacción: resuelve login y consent programáticamente (sin HTML). Se registra
        // ANTES del mount del provider para ganarle la ruta /oauth/interaction/:uid.
        expressApp.get(
          '/oauth/interaction/:uid',
          async (req: unknown, res: unknown) => {
            try {
              const details = await provider.interactionDetails(req, res);
              const { prompt, params } = details;
              if (prompt.name === 'login') {
                await provider.interactionFinished(
                  req,
                  res,
                  { login: { accountId: stubAccountId } },
                  { mergeWithLastSubmission: false },
                );
                return;
              }
              if (prompt.name === 'consent') {
                const grant = details.grantId
                  ? await provider.Grant.find(details.grantId)
                  : new provider.Grant({
                      accountId: stubAccountId,
                      clientId: params.client_id,
                    });
                const d = prompt.details;
                if (d.missingOIDCScope) {
                  grant.addOIDCScope(
                    (d.missingOIDCScope as string[]).join(' '),
                  );
                }
                if (d.missingOIDCClaims) {
                  grant.addOIDCClaims(d.missingOIDCClaims as string[]);
                }
                if (d.missingResourceScopes) {
                  for (const [indicator, scopes] of Object.entries(
                    d.missingResourceScopes as Record<string, string[]>,
                  )) {
                    grant.addResourceScope(indicator, scopes.join(' '));
                  }
                }
                const grantId = await grant.save();
                await provider.interactionFinished(
                  req,
                  res,
                  { consent: { grantId } },
                  { mergeWithLastSubmission: true },
                );
                return;
              }
              (res as { status: (n: number) => { end: (s: string) => void } })
                .status(500)
                .end(`unexpected prompt: ${prompt.name}`);
            } catch (err) {
              (res as { status: (n: number) => { end: (s: string) => void } })
                .status(500)
                .end(`interaction error: ${(err as Error)?.message ?? err}`);
            }
          },
        );

        expressApp.use('/oauth', provider.callback());
      },
    });

    // El `sub` del token será el id de ESTE usuario; 4a hace user.findUnique({ id: BigInt(sub) }).
    const prisma = handle.app.get(PrismaService);
    const user = await prisma.user.create({
      data: {
        firebaseUid: 'as-e2e',
        email: 'as@e2e.test',
        displayName: 'AS E2E',
        role: 'member',
      },
    });
    stubAccountId = user.id.toString();
  }, 180_000);

  afterAll(async () => {
    // finally garantiza el cleanup de env aunque close() lance (evita fugas entre archivos de test).
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

  it('exposes discovery with S256 PKCE', async () => {
    const res = await request(handle.app.getHttpServer())
      .get('/oauth/.well-known/openid-configuration')
      .expect(200);
    expect(res.body.code_challenge_methods_supported).toContain('S256');
    expect(res.body.token_endpoint).toContain('/oauth/token');
  });

  it('issues a JWT access token that the API accepts as an mcp oauth credential', async () => {
    const server = handle.app.getHttpServer();
    const verifier = b64url(randomBytes(32));
    const challenge = b64url(createHash('sha256').update(verifier).digest());

    // Jar de cookies manual: se acumulan TODAS las cookies (sesión + interacción + resume) y se
    // reenvían enteras en cada salto; un valor vacío = borrado. Es lo más fiable con redirects.
    const jar = new Map<string, string>();
    const collect = (res: request.Response) => {
      const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
      if (!raw) return;
      for (const line of raw) {
        const pair = line.split(';')[0];
        const eq = pair.indexOf('=');
        if (eq < 0) continue;
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (!value) jar.delete(name);
        else jar.set(name, value);
      }
    };
    const cookieHeader = () =>
      [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    const hop = async (path: string) => {
      const res = await request(server)
        .get(path)
        .set('Cookie', cookieHeader())
        .redirects(0);
      collect(res);
      return res;
    };

    const authQuery = new URLSearchParams({
      client_id: 'mcp-test-client',
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: 'openid mcp:read mcp:write',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      resource: AUD,
    }).toString();

    // authorize → (interaction login) → (interaction consent) → redirect_uri?code=...
    // Seguimos redirects a mano: cada salto al /oauth/interaction/:uid dispara el stub.
    let res = await hop(`/oauth/auth?${authQuery}`);
    let code: string | null = null;
    for (let i = 0; i < 8 && !code; i += 1) {
      if (res.status >= 400) {
        throw new Error(
          `authorize/resume hop ${i} errored: status=${res.status} body=${res.text}`,
        );
      }
      expect(res.status).toBeGreaterThanOrEqual(300);
      expect(res.status).toBeLessThan(400);
      const loc = res.headers['location'] as string;
      expect(loc).toBeTruthy();
      if (loc.startsWith(REDIRECT_URI)) {
        const target = new URL(loc);
        if (target.searchParams.get('error')) {
          throw new Error(
            `authorization redirected with error: ${target.search}`,
          );
        }
        code = target.searchParams.get('code');
        break;
      }
      const url = loc.startsWith('http') ? new URL(loc) : new URL(loc, ISS);
      res = await hop(url.pathname + url.search);
    }
    if (!code) {
      throw new Error(
        `authorization_code not obtained; last status=${res.status} location=${res.headers['location']} body=${res.text}`,
      );
    }

    // Canje del code: el access_token DEBE salir de esta respuesta real (no hand-minted).
    const tokenRes = await request(server)
      .post('/oauth/token')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: 'mcp-test-client',
        code_verifier: verifier,
        resource: AUD,
      })
      .redirects(0);
    expect(tokenRes.status).toBe(200);
    const accessToken = tokenRes.body.access_token as string;
    expect(accessToken).toBeTruthy();

    // Localiza fallos emisión-vs-aceptación: claims del token emitido por el AS.
    const claims = decodeJwt(accessToken);
    expect(claims.iss).toBe(ISS);
    expect(claims.aud).toBe(AUD);
    expect(claims.sub).toBe(stubAccountId);
    expect(typeof claims.exp).toBe('number');
    expect(String(claims.scope)).toContain('mcp:read');

    // El token del AS es aceptado por la 3ª vía del AuthGuard (Fase 4a).
    await request(server)
      .get('/v1/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });
});
