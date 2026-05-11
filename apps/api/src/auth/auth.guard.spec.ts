import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../prisma/prisma.service';

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
    const guard = new AuthGuard(firebase, prisma);

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
    const guard = new AuthGuard(firebase, prisma);

    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    const ok = await guard.canActivate(context);
    expect(ok).toBe(true);
    expect(req.user).toMatchObject({ id: 10n, firebaseUid: 'fb-uid-1' });
  });
});
