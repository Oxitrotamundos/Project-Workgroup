import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { AuthUser } from '../auth/auth.guard';
import { Prisma } from '../generated/prisma/client';

const admin: AuthUser = {
  id: 1n,
  role: 'admin',
  firebaseUid: null,
  via: 'api_key',
};
const member: AuthUser = {
  id: 20n,
  role: 'member',
  firebaseUid: null,
  via: 'api_key',
};

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
  version: 1,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('TasksService', () => {
  const fakeCalendar = {
    id: 1n,
    scope: 'global' as const,
    projectId: null,
    name: 'Test',
    timezone: 'UTC',
    patterns: [],
    holidays: [],
    hoursPerDay: 8,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const makeResolver = () => ({
    resolveForProject: jest.fn().mockResolvedValue(fakeCalendar),
    loadGlobal: jest.fn().mockResolvedValue(fakeCalendar),
    loadForProjectStrict: jest.fn().mockResolvedValue(null),
    invalidateAll: jest.fn(),
    invalidateProject: jest.fn(),
    hoursForWeekday: jest.fn().mockReturnValue(8),
    effectiveHoursPerDay: jest.fn().mockReturnValue(8),
    isWorkingDay: jest.fn().mockReturnValue(true),
    isHoliday: jest.fn().mockReturnValue(false),
  });

  const makeScheduling = () => ({
    scheduleFromHours: jest.fn(({ estimatedHours, startDateTime }: any) => ({
      startDate: startDateTime,
      endDate: startDateTime,
      workload: estimatedHours
        ? [{ date: startDateTime, allocatedHours: estimatedHours }]
        : [],
    })),
    scheduleFromRange: jest.fn(({ startDateTime, endDateTime }: any) => ({
      startDate: startDateTime,
      endDate: endDateTime,
      estimatedHours: 8,
      workload: [{ date: startDateTime, allocatedHours: 8 }],
    })),
    workingHoursInRange: jest.fn().mockReturnValue(8),
    hoursAvailableOnDay: jest.fn().mockReturnValue(8),
    workSlotsForDay: jest.fn().mockReturnValue([]),
    toUtcDateOnly: jest.fn((d: Date) => d),
    addDays: jest.fn(
      (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000),
    ),
  });

  const makeService = (prisma: any) =>
    new TasksService(prisma, makeResolver() as any, makeScheduling() as any);

  const makePrisma = () => {
    const prisma: any = {
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
      workload: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
    return prisma;
  };

  it('rejects task access for users outside the project', async () => {
    const prisma = makePrisma();
    prisma.task.findUnique.mockResolvedValue(taskRow());
    prisma.project.findUnique.mockResolvedValue({ ownerId: 10n });
    prisma.projectMember.findUnique.mockResolvedValue(null);
    const service = makeService(prisma);

    await expect(service.getById(10n, member)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
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
    const service = makeService(prisma);

    const result = await service.create(1n, {
      name: 'Milestone',
      startDate: '2026-01-05',
      endDate: '2026-01-10',
      priority: 'medium',
      status: 'not-started',
      type: 'milestone',
      color: '#F59E0B',
    });

    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startDate: new Date('2026-01-05'),
          endDate: new Date('2026-01-05'),
          duration: '0',
        }),
      }),
    );
    expect(result.duration).toBe('0');
  });

  it('recalculates parent summaries after progress changes', async () => {
    const prisma = makePrisma();
    const child = taskRow({
      id: 11n,
      parentId: 10n,
      progress: 50,
      duration: { toString: () => '2' },
    });
    const summary = taskRow({ id: 10n, type: 'summary', progress: 0 });
    prisma.task.findUnique.mockResolvedValue(child);
    prisma.task.update.mockResolvedValue(child);
    prisma.task.findMany.mockResolvedValue([summary, child]);
    const service = makeService(prisma);

    await service.updateProgress(11n, { progress: 50 }, admin);

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10n },
        data: expect.objectContaining({ progress: 50 }),
      }),
    );
  });

  it('rejects update when expectedVersion does not match current version', async () => {
    const prisma = makePrisma();
    const stored = taskRow({ version: 5 });
    prisma.task.findUnique.mockImplementation(({ select }: any) => {
      if (select?.version) return Promise.resolve({ version: 5 });
      return Promise.resolve(stored);
    });
    prisma.task.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '7.8.0',
      } as any),
    );
    const service = makeService(prisma);

    await expect(
      service.update(10n, { name: 'new', expectedVersion: 4 }, admin),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 10n, version: 4 } }),
    );
  });

  it('rejects bulkUpdate when one task does not belong to the project', async () => {
    const prisma = makePrisma();
    prisma.task.findMany.mockResolvedValue([{ id: 10n }]);
    const service = makeService(prisma);

    await expect(
      service.bulkUpdate(
        1n,
        {
          updates: [
            { id: '10', data: { name: 'A' } },
            { id: '99', data: { name: 'B' } },
          ],
        },
        admin,
      ),
    ).rejects.toThrow(/do not belong/);
  });

  it('derives estimatedHours from the dragged range using scheduleFromRange', async () => {
    const prisma = makePrisma();
    const before = taskRow({
      version: 1,
      estimatedHours: { toString: () => '0' },
    });
    const after = taskRow({
      version: 2,
      startDate: new Date('2026-01-05T00:00:00.000Z'),
      endDate: new Date('2026-01-09T00:00:00.000Z'),
      duration: { toString: () => '5.00' },
      estimatedHours: { toString: () => '40.00' },
    });
    prisma.task.findUnique
      .mockResolvedValueOnce(before)
      .mockResolvedValue(after);
    prisma.task.update.mockResolvedValue(after);
    prisma.task.findMany.mockResolvedValue([after]);

    const resolver = makeResolver();
    const scheduling = makeScheduling();
    scheduling.scheduleFromRange.mockReturnValue({
      startDate: new Date('2026-01-05T00:00:00.000Z'),
      endDate: new Date('2026-01-09T00:00:00.000Z'),
      estimatedHours: 40,
      workload: [
        { date: new Date('2026-01-05T00:00:00.000Z'), allocatedHours: 8 },
        { date: new Date('2026-01-06T00:00:00.000Z'), allocatedHours: 8 },
        { date: new Date('2026-01-07T00:00:00.000Z'), allocatedHours: 8 },
        { date: new Date('2026-01-08T00:00:00.000Z'), allocatedHours: 8 },
        { date: new Date('2026-01-09T00:00:00.000Z'), allocatedHours: 8 },
      ],
    });
    const service = new TasksService(
      prisma,
      resolver as any,
      scheduling as any,
    );

    await service.update(
      10n,
      {
        startDate: '2026-01-05T00:00:00.000Z',
        endDate: '2026-01-09T00:00:00.000Z',
        expectedVersion: 1,
      },
      admin,
    );

    expect(scheduling.scheduleFromRange).toHaveBeenCalled();
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          duration: '5.00',
          estimatedHours: new Prisma.Decimal('40.00'),
        }),
      }),
    );
  });

  it('increments version on successful update', async () => {
    const prisma = makePrisma();
    const before = taskRow({ version: 1 });
    const after = taskRow({ name: 'renamed', version: 2 });
    prisma.task.findUnique
      .mockResolvedValueOnce(before)
      .mockResolvedValue(after);
    prisma.task.update.mockResolvedValue(after);
    prisma.task.findMany.mockResolvedValue([after]);
    const service = makeService(prisma);

    const result = await service.update(
      10n,
      { name: 'renamed', expectedVersion: 1 },
      admin,
    );

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10n, version: 1 },
        data: expect.objectContaining({
          name: 'renamed',
          version: { increment: 1 },
        }),
      }),
    );
    expect(result.version).toBe(2);
  });
});
