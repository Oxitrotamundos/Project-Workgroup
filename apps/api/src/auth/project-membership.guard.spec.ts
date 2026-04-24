import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectMembershipGuard } from './project-membership.guard';
import { PrismaService } from '../prisma/prisma.service';

const buildCtx = (user: any, params: any, param: string | undefined) => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(param) } as unknown as Reflector;
  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user, params }) }),
  } as unknown as ExecutionContext;
  return { reflector, ctx };
};

describe('ProjectMembershipGuard', () => {
  it('allows when no metadata', async () => {
    const { reflector, ctx } = buildCtx({ id: 1n, role: 'member' }, { id: '5' }, undefined);
    const prisma = {} as PrismaService;
    expect(await new ProjectMembershipGuard(reflector, prisma).canActivate(ctx)).toBe(true);
  });

  it('allows admin always', async () => {
    const { reflector, ctx } = buildCtx({ id: 1n, role: 'admin' }, { id: '5' }, 'id');
    const prisma = { project: { findUnique: jest.fn() }, projectMember: { findUnique: jest.fn() } } as unknown as PrismaService;
    expect(await new ProjectMembershipGuard(reflector, prisma).canActivate(ctx)).toBe(true);
  });

  it('allows owner', async () => {
    const { reflector, ctx } = buildCtx({ id: 7n, role: 'member' }, { id: '5' }, 'id');
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ ownerId: 7n }) },
      projectMember: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    expect(await new ProjectMembershipGuard(reflector, prisma).canActivate(ctx)).toBe(true);
  });

  it('allows project member', async () => {
    const { reflector, ctx } = buildCtx({ id: 8n, role: 'member' }, { id: '5' }, 'id');
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ ownerId: 1n }) },
      projectMember: { findUnique: jest.fn().mockResolvedValue({ userId: 8n }) },
    } as unknown as PrismaService;
    expect(await new ProjectMembershipGuard(reflector, prisma).canActivate(ctx)).toBe(true);
  });

  it('forbids non-member', async () => {
    const { reflector, ctx } = buildCtx({ id: 9n, role: 'member' }, { id: '5' }, 'id');
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ ownerId: 1n }) },
      projectMember: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    await expect(new ProjectMembershipGuard(reflector, prisma).canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
