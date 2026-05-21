import { Test } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProjectsService settings', () => {
  const makePrisma = () => ({
    project: {
      findUnique: jest.fn(),
    },
    projectSettings: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  });

  const makeService = async (prisma: ReturnType<typeof makePrisma>) => {
    const module = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    return module.get(ProjectsService);
  };

  const settingsRow = (
    overrides: Partial<{
      projectId: bigint;
      timeGranularity: string;
      createdAt: Date;
      updatedAt: Date;
    }> = {},
  ) => ({
    projectId: 1n,
    timeGranularity: 'hours',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });

  it('getSettings returns existing settings when present', async () => {
    const prisma = makePrisma();
    prisma.projectSettings.findUnique.mockResolvedValue(
      settingsRow({ timeGranularity: 'days' }),
    );
    const service = await makeService(prisma);

    const result = await service.getSettings(1n);
    expect(result.timeGranularity).toBe('days');
    expect(prisma.projectSettings.create).not.toHaveBeenCalled();
  });

  it('getSettings creates default hours settings when missing', async () => {
    const prisma = makePrisma();
    prisma.projectSettings.findUnique.mockResolvedValue(null);
    prisma.project.findUnique.mockResolvedValue({ id: 1n });
    prisma.projectSettings.create.mockResolvedValue(settingsRow());
    const service = await makeService(prisma);

    const result = await service.getSettings(1n);
    expect(result.timeGranularity).toBe('hours');
    expect(prisma.projectSettings.create).toHaveBeenCalledWith({
      data: { projectId: 1n, timeGranularity: 'hours' },
    });
  });

  it('updateSettings upserts the granularity', async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue({ id: 1n });
    prisma.projectSettings.upsert.mockResolvedValue(
      settingsRow({ timeGranularity: 'days' }),
    );
    const service = await makeService(prisma);

    const result = await service.updateSettings(1n, {
      timeGranularity: 'days',
    });
    expect(result.timeGranularity).toBe('days');
    expect(prisma.projectSettings.upsert).toHaveBeenCalledWith({
      where: { projectId: 1n },
      create: { projectId: 1n, timeGranularity: 'days' },
      update: { timeGranularity: 'days' },
    });
  });

  it('updateSettings rejects unknown granularity', async () => {
    const prisma = makePrisma();
    const service = await makeService(prisma);
    await expect(
      service.updateSettings(1n, { timeGranularity: 'weeks' as any }),
    ).rejects.toThrow();
  });

  it('updateSettings throws NotFound when project missing', async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(null);
    const service = await makeService(prisma);
    await expect(
      service.updateSettings(1n, { timeGranularity: 'days' }),
    ).rejects.toThrow('project not found');
  });
});
