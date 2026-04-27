import { ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { AuthUser } from '../auth/auth.guard';

const admin: AuthUser = { id: 1n, role: 'admin', firebaseUid: null, via: 'api_key' };
const member: AuthUser = { id: 20n, role: 'member', firebaseUid: null, via: 'api_key' };

const taskRow = (overrides: Partial<any> = {}) => ({
  id: 10n,
  projectId: 1n,
  parentId: null,
  assigneeId: null,
  name: 'Task',
  description: null,
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: new Date('2026-01-02T00:00:00.000Z'),
  duration: { toString: () => '1' },
  progress: 0,
  priority: 'medium',
  status: 'not_started',
  type: 'task',
  color: '#3B82F6',
  order: { toString: () => '1000.000000000000000' },
  open: true,
  tags: [],
  estimatedHours: { toString: () => '0' },
  actualHours: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('TasksService', () => {
  const makePrisma = () => ({
    project: {
      findUnique: jest.fn(),
    },
    projectMember: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    task: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  });

  it('rejects task access for users outside the project', async () => {
    const prisma = makePrisma();
    prisma.task.findUnique.mockResolvedValue(taskRow());
    prisma.project.findUnique.mockResolvedValue({ ownerId: 10n });
    prisma.projectMember.findUnique.mockResolvedValue(null);
    const service = new TasksService(prisma as any);

    await expect(service.getById(10n, member)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('normalizes milestones to zero duration with matching start/end dates', async () => {
    const prisma = makePrisma();
    const created = taskRow({
      type: 'milestone',
      endDate: new Date('2026-01-05T00:00:00.000Z'),
      duration: { toString: () => '0' },
    });
    prisma.task.findFirst.mockResolvedValue(null);
    prisma.task.create.mockResolvedValue(created);
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.findUnique.mockResolvedValue(created);
    const service = new TasksService(prisma as any);

    const result = await service.create(1n, {
      name: 'Milestone',
      startDate: '2026-01-05',
      endDate: '2026-01-10',
      priority: 'medium',
      status: 'not-started',
      type: 'milestone',
      color: '#F59E0B',
    });

    expect(prisma.task.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        startDate: new Date('2026-01-05'),
        endDate: new Date('2026-01-05'),
        duration: '0',
      }),
    }));
    expect(result.duration).toBe('0');
  });

  it('recalculates parent summaries after progress changes', async () => {
    const prisma = makePrisma();
    const child = taskRow({ id: 11n, parentId: 10n, progress: 50, duration: { toString: () => '2' } });
    const summary = taskRow({ id: 10n, type: 'summary', progress: 0 });
    prisma.task.findUnique.mockResolvedValue(child);
    prisma.task.update.mockResolvedValue(child);
    prisma.task.findMany.mockResolvedValue([summary, child]);
    const service = new TasksService(prisma as any);

    await service.updateProgress(11n, { progress: 50 }, admin);

    expect(prisma.task.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 10n },
      data: expect.objectContaining({ progress: 50 }),
    }));
  });
});
