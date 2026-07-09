import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ResourcesService } from './resources.service';

const resourceRow = (overrides: Partial<any> = {}) => ({
  id: 1n,
  name: 'Resource',
  email: null,
  kind: 'placeholder',
  status: 'active',
  userId: null,
  avatarUrl: null,
  discipline: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('ResourcesService', () => {
  const makePrisma = () => ({
    resource: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  });

  const makeService = (prisma: ReturnType<typeof makePrisma>) =>
    new ResourcesService(prisma as any);

  describe('create', () => {
    it('forces kind to placeholder even though the dto has no kind field', async () => {
      const prisma = makePrisma();
      prisma.resource.create.mockResolvedValue(resourceRow());
      const service = makeService(prisma);

      await service.create({ name: 'New resource' } as any);

      expect(prisma.resource.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ kind: 'placeholder' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('ignores name/email/avatarUrl on a user-linked resource but applies discipline/status', async () => {
      const prisma = makePrisma();
      prisma.resource.findUnique.mockResolvedValue(
        resourceRow({ kind: 'user', userId: 5n }),
      );
      prisma.resource.update.mockResolvedValue(resourceRow({ kind: 'user' }));
      const service = makeService(prisma);

      await service.update(1n, {
        name: 'Ignored name',
        email: 'ignored@example.com',
        avatarUrl: 'https://ignored.example/avatar.png',
        discipline: 'Engineering',
        status: 'inactive',
      });

      expect(prisma.resource.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: {
          name: undefined,
          email: undefined,
          avatarUrl: undefined,
          discipline: 'Engineering',
          status: 'inactive',
        },
      });
    });

    it('applies name/email/avatarUrl on a placeholder resource', async () => {
      const prisma = makePrisma();
      prisma.resource.findUnique.mockResolvedValue(
        resourceRow({ kind: 'placeholder' }),
      );
      prisma.resource.update.mockResolvedValue(
        resourceRow({ name: 'Updated name' }),
      );
      const service = makeService(prisma);

      await service.update(1n, {
        name: 'Updated name',
        email: 'placeholder@example.com',
      });

      expect(prisma.resource.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: {
          name: 'Updated name',
          email: 'placeholder@example.com',
          avatarUrl: undefined,
          discipline: undefined,
          status: undefined,
        },
      });
    });

    it('throws NotFoundException when the resource does not exist', async () => {
      const prisma = makePrisma();
      prisma.resource.findUnique.mockResolvedValue(null);
      const service = makeService(prisma);

      await expect(
        service.update(99n, { name: 'anything' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('throws BadRequestException when the resource is not a placeholder', async () => {
      const prisma = makePrisma();
      prisma.resource.findUnique.mockResolvedValue(
        resourceRow({
          kind: 'user',
          _count: { assignedTasks: 0, workload: 0 },
        }),
      );
      const service = makeService(prisma);

      await expect(service.remove(1n)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.resource.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the placeholder has assigned tasks', async () => {
      const prisma = makePrisma();
      prisma.resource.findUnique.mockResolvedValue(
        resourceRow({
          kind: 'placeholder',
          _count: { assignedTasks: 2, workload: 0 },
        }),
      );
      const service = makeService(prisma);

      await expect(service.remove(1n)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.resource.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the placeholder has workload', async () => {
      const prisma = makePrisma();
      prisma.resource.findUnique.mockResolvedValue(
        resourceRow({
          kind: 'placeholder',
          _count: { assignedTasks: 0, workload: 3 },
        }),
      );
      const service = makeService(prisma);

      await expect(service.remove(1n)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.resource.delete).not.toHaveBeenCalled();
    });

    it('deletes a placeholder without references', async () => {
      const prisma = makePrisma();
      prisma.resource.findUnique.mockResolvedValue(
        resourceRow({
          kind: 'placeholder',
          _count: { assignedTasks: 0, workload: 0 },
        }),
      );
      const service = makeService(prisma);

      await service.remove(1n);

      expect(prisma.resource.delete).toHaveBeenCalledWith({
        where: { id: 1n },
      });
    });

    it('throws NotFoundException when the resource does not exist', async () => {
      const prisma = makePrisma();
      prisma.resource.findUnique.mockResolvedValue(null);
      const service = makeService(prisma);

      await expect(service.remove(1n)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('linkToUser', () => {
    // El $transaction del service recibe un callback; lo ejecutamos contra un tx mock propio.
    const makeTx = () => ({
      resource: {
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      task: {
        updateMany: jest.fn(),
      },
      workload: {
        updateMany: jest.fn(),
      },
    });

    it('merges the user auto-generated resource into the placeholder and links it', async () => {
      const prisma = makePrisma();
      const tx = makeTx();
      prisma.$transaction.mockImplementation((fn: any) => fn(tx));
      const service = makeService(prisma);

      const placeholderId = 1n;
      const userId = 5n;
      const userResourceId = 2n;

      tx.resource.findUnique
        .mockResolvedValueOnce(
          resourceRow({ id: placeholderId, kind: 'placeholder' }),
        ) // lookup por id (placeholder objetivo)
        .mockResolvedValueOnce(
          resourceRow({ id: userResourceId, userId, kind: 'user' }),
        ); // lookup por userId (resource auto-generado, id distinto)
      tx.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'user@example.com',
      });
      tx.resource.update.mockResolvedValue(
        resourceRow({
          id: placeholderId,
          kind: 'user',
          userId,
          email: 'user@example.com',
        }),
      );

      await service.linkToUser(placeholderId, userId);

      expect(tx.task.updateMany).toHaveBeenCalledWith({
        where: { assigneeId: userResourceId },
        data: { assigneeId: placeholderId },
      });
      expect(tx.workload.updateMany).toHaveBeenCalledWith({
        where: { resourceId: userResourceId },
        data: { resourceId: placeholderId },
      });
      expect(tx.resource.delete).toHaveBeenCalledWith({
        where: { id: userResourceId },
      });
      expect(tx.resource.update).toHaveBeenCalledWith({
        where: { id: placeholderId },
        data: { kind: 'user', userId, email: 'user@example.com' },
      });
    });

    it('throws BadRequestException when the target resource is not a placeholder', async () => {
      const prisma = makePrisma();
      const tx = makeTx();
      prisma.$transaction.mockImplementation((fn: any) => fn(tx));
      tx.resource.findUnique.mockResolvedValueOnce(
        resourceRow({ id: 1n, kind: 'user' }),
      );
      const service = makeService(prisma);

      await expect(service.linkToUser(1n, 5n)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tx.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the user does not exist', async () => {
      const prisma = makePrisma();
      const tx = makeTx();
      prisma.$transaction.mockImplementation((fn: any) => fn(tx));
      tx.resource.findUnique.mockResolvedValueOnce(
        resourceRow({ id: 1n, kind: 'placeholder' }),
      );
      tx.user.findUnique.mockResolvedValue(null);
      const service = makeService(prisma);

      await expect(service.linkToUser(1n, 5n)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(tx.resource.update).not.toHaveBeenCalled();
    });
  });
});
