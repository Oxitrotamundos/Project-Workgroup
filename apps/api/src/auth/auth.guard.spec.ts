import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { AuthGuard } from './auth.guard';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../prisma/prisma.service';

// Config sin env OAuth: desactiva la tercera vía (comportamiento actual en prod/dev).
const oauthDisabledConfig = { get: () => undefined } as any;

const ctx = (auth: string | undefined): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: auth }, user: undefined }),
    }),
  }) as unknown as ExecutionContext;

describe('AuthGuard (firebase path)', () => {
  it('rejects request with no Authorization header', async () => {
    const firebase = { verifyIdToken: jest.fn() } as unknown as FirebaseService;
    const prisma = {
      user: { findUnique: jest.fn() },
      apiKey: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const guard = new AuthGuard(firebase, prisma, oauthDisabledConfig);

    await expect(guard.canActivate(ctx(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a valid Firebase ID token and attaches user', async () => {
    const firebase = {
      verifyIdToken: jest
        .fn()
        .mockResolvedValue({ uid: 'fb-uid-1', email: 'x@y.z' }),
    } as unknown as FirebaseService;
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 10n,
          firebaseUid: 'fb-uid-1',
          role: 'member',
        }),
      },
      apiKey: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const req = {
      headers: { authorization: 'Bearer good-token' },
      user: undefined,
    } as any;
    const guard = new AuthGuard(firebase, prisma, oauthDisabledConfig);

    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    const ok = await guard.canActivate(context);
    expect(ok).toBe(true);
    expect(req.user).toMatchObject({ id: 10n, firebaseUid: 'fb-uid-1' });
  });
});

const ISS = 'https://as.test';
const AUD = 'https://rs.test';

// Contexto HTTP falso con header Authorization y método.
function makeCtx(authorization: string | undefined, method = 'GET') {
  const req: any = { headers: { authorization }, method };
  const res: any = { setHeader: jest.fn() };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    __req: req,
    __res: res,
  } as any;
}

const firebaseStub = {
  verifyIdToken: jest.fn().mockRejectedValue(new Error('no')),
};

describe('AuthGuard — OAuth JWT path', () => {
  let privateKey: any;
  let jwks: string;

  beforeAll(async () => {
    const kp = await generateKeyPair('RS256');
    privateKey = kp.privateKey;
    const jwk = await exportJWK(kp.publicKey);
    jwk.kid = 'test';
    jwk.alg = 'RS256';
    jwk.use = 'sig';
    jwks = JSON.stringify({ keys: [jwk] });
  });

  const mint = (
    over: Record<string, unknown> = {},
    opts: { iss?: string; aud?: string; sub?: string } = {},
  ) =>
    new SignJWT({ scope: 'mcp:read mcp:write', ...over })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setSubject(opts.sub ?? '1')
      .setIssuer(opts.iss ?? ISS)
      .setAudience(opts.aud ?? AUD)
      .setExpirationTime('1h')
      .sign(privateKey);

  const configStub = () => ({
    get: (k: string) =>
      ({
        MCP_OAUTH_JWKS: jwks,
        MCP_OAUTH_ISSUER: ISS,
        MCP_OAUTH_AUDIENCE: AUD,
      })[k],
  });
  const prismaStub = () => ({
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 1n, firebaseUid: 'fb', role: 'member' }),
    },
    apiKey: { findMany: jest.fn().mockResolvedValue([]) },
  });

  it('accepts a valid RS256 token and sets via:oauth + scope', async () => {
    const prisma = prismaStub();
    const guard = new AuthGuard(
      firebaseStub as any,
      prisma as any,
      configStub() as any,
    );
    const ctx = makeCtx(`Bearer ${await mint()}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.__req.user).toMatchObject({
      id: 1n,
      via: 'oauth',
      scope: 'mcp:read mcp:write',
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 1n } });
  });

  it('rejects a token with the wrong audience (falls through to 401)', async () => {
    const guard = new AuthGuard(
      firebaseStub as any,
      prismaStub() as any,
      configStub() as any,
    );
    const ctx = makeCtx(`Bearer ${await mint({}, { aud: 'https://evil' })}`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token without an exp claim (would otherwise be valid forever)', async () => {
    const guard = new AuthGuard(
      firebaseStub as any,
      prismaStub() as any,
      configStub() as any,
    );
    // JWT correctamente firmado pero sin exp: omitimos setExpirationTime.
    const noExpToken = await new SignJWT({ scope: 'mcp:read mcp:write' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setSubject('1')
      .setIssuer(ISS)
      .setAudience(AUD)
      .sign(privateKey);
    const ctx = makeCtx(`Bearer ${noExpToken}`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects when the subject user does not exist', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      apiKey: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const guard = new AuthGuard(
      firebaseStub as any,
      prisma as any,
      configStub() as any,
    );
    const ctx = makeCtx(`Bearer ${await mint()}`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('disables the OAuth path when MCP_OAUTH_JWKS is not configured', async () => {
    const config = { get: () => undefined };
    const prisma = prismaStub();
    const guard = new AuthGuard(
      firebaseStub as any,
      prisma as any,
      config as any,
    );
    const ctx = makeCtx(`Bearer ${await mint()}`);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects DELETE for an oauth token (postura A)', async () => {
    const guard = new AuthGuard(
      firebaseStub as any,
      prismaStub() as any,
      configStub() as any,
    );
    const ctx = makeCtx(`Bearer ${await mint()}`, 'DELETE');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('sets WWW-Authenticate on a 401', async () => {
    const guard = new AuthGuard(
      firebaseStub as any,
      prismaStub() as any,
      configStub() as any,
    );
    const ctx = makeCtx(undefined);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(ctx.__res.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      expect.stringContaining('resource_metadata='),
    );
  });
});
