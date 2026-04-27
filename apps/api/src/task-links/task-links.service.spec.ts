import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { TaskLinksService } from './task-links.service';
import { AuthUser } from '../auth/auth.guard';

const admin: AuthUser = { id: 1n, role: 'admin', firebaseUid: null, via: 'api_key' };
const member: AuthUser = { id: 20n, role: 'member', firebaseUid: null, via: 'api_key' };

const linkRow = {
  id: 100n,
  projectId: 1n,
  sourceTaskId: 10n,
  targetTaskId: 11n,
  type: 'e2s',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('TaskLinksService', () => {
  const makePrisma = () => {
    const prisma: any = {
      project: {
        findUnique: jest.fn(),
      },
      projectMember: {
        findUnique: jest.fn(),
      },
      task: {
        findUnique: jest.fn(),
      },
      taskLink: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((cb: (tx: any) => Promise<unknown>): Promise<unknown> => cb(prisma)),
    };
    return prisma;
  };

  it('rejects self links before touching the database', async () => {
    const prisma = makePrisma();
    const service = new TaskLinksService(prisma as any);

    await expect(
      service.create(1n, { sourceTaskId: '10', targetTaskId: '10', type: 'e2s' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects links whose target task belongs to another project', async () => {
    const prisma = makePrisma();
    prisma.task.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(where.id === 10n ? { projectId: 1n } : { projectId: 2n }),
    );
    const service = new TaskLinksService(prisma as any);

    await expect(
      service.create(1n, { sourceTaskId: '10', targetTaskId: '11', type: 'e2s' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects link access for users outside the project', async () => {
    const prisma = makePrisma();
    prisma.taskLink.findUnique.mockResolvedValue(linkRow);
    prisma.project.findUnique.mockResolvedValue({ ownerId: 10n });
    prisma.projectMember.findUnique.mockResolvedValue(null);
    const service = new TaskLinksService(prisma as any);

    await expect(service.getById(100n, member)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('detects duplicate link type updates', async () => {
    const prisma = makePrisma();
    prisma.taskLink.findUnique
      .mockResolvedValueOnce(linkRow)
      .mockResolvedValueOnce({ ...linkRow, id: 101n, type: 's2s' });
    const service = new TaskLinksService(prisma as any);

    await expect(service.update(100n, { type: 's2s' }, admin)).rejects.toBeInstanceOf(ConflictException);
  });
});
