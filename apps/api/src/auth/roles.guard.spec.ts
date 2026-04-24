import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const ctxFor = (user: any, roles: string[] | undefined) => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(roles) } as unknown as Reflector;
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
    return { guard: new RolesGuard(reflector), context };
  };

  it('allows when no roles metadata', async () => {
    const { guard, context } = ctxFor({ role: 'member' }, undefined);
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('rejects when role not in allowed list', async () => {
    const { guard, context } = ctxFor({ role: 'member' }, ['admin']);
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('allows when role in allowed list', async () => {
    const { guard, context } = ctxFor({ role: 'pm' }, ['admin', 'pm']);
    expect(await guard.canActivate(context)).toBe(true);
  });
});
