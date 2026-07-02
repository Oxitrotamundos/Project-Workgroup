import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OAuthCapabilityGuard } from './oauth-capability.guard';

describe('OAuthCapabilityGuard', () => {
  const ctxFor = (user: any, denied: boolean | undefined) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(denied),
    } as unknown as Reflector;
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
    return { guard: new OAuthCapabilityGuard(reflector), context };
  };

  it('allows when the route has no @DenyOAuth() metadata', async () => {
    const { guard, context } = ctxFor({ via: 'oauth' }, undefined);
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('rejects an oauth principal on a @DenyOAuth() route', async () => {
    const { guard, context } = ctxFor({ via: 'oauth' }, true);
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows a firebase principal on a @DenyOAuth() route', async () => {
    const { guard, context } = ctxFor({ via: 'firebase' }, true);
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('allows an api_key principal on a @DenyOAuth() route', async () => {
    const { guard, context } = ctxFor({ via: 'api_key' }, true);
    expect(await guard.canActivate(context)).toBe(true);
  });
});
