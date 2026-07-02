import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { MetricsService } from '../observability/metrics.service';
import {
  ApplyPropagationDto,
  BulkTaskOpenStateConflict,
  BulkTaskOpenStateDto,
  BulkTaskOpenStateResponse,
  BulkTaskUpdateDto,
  BulkTaskUpdateResponse,
  CreateTaskDto,
  PropagationChange,
  PropagationPreview,
  SummaryPatch,
  TaskMutationResponse,
  TaskResponse,
  UpdateOrderDto,
  UpdateTaskPositionDto,
  UpdateProgressDto,
  UpdateTaskDto,
} from '@project-workgroup/shared';
import { AuthUser } from '../auth/auth.guard';
import {
  statusToPrisma,
  statusToWire,
  priorityToPrisma,
  priorityToWire,
} from './wire';
import { firstOrder, between, after } from './fractional-index';
import { CalendarResolverService } from '../calendar/calendar-resolver.service';
import {
  SchedulingService,
  ScheduledSlot,
} from '../calendar/scheduling.service';
import { TaskScheduleCalculator } from '../calendar/task-schedule-calculator.service';
import { SummaryRecalculationService } from './summary-recalculation.service';

type TaskRow = {
  id: bigint;
  projectId: bigint;
  parentId: bigint | null;
  assigneeId: bigint | null;
  name: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  duration: { toString(): string };
  progress: number;
  priority: string;
  status: string;
  type: string;
  color: string;
  order: { toString(): string };
  open: boolean;
  tags: string[];
  estimatedHours: { toString(): string };
  actualHours: { toString(): string } | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type TaskUpdatePlan = {
  scheduleTouched: boolean;
  workloadTouched: boolean;
  summariesTouched: boolean;
  versioned: boolean;
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarResolver: CalendarResolverService,
    private readonly scheduling: SchedulingService,
    private readonly summaries: SummaryRecalculationService,
    private readonly scheduleCalculator: TaskScheduleCalculator,
    @Optional()
    @InjectPinoLogger(TasksService.name)
    private readonly logger?: PinoLogger,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  private logOp(
    op: string,
    fields: Record<string, unknown>,
    durationMs: number,
  ): void {
    this.logger?.info({ op, durationMs, ...fields }, `task ${op}`);
    this.metrics?.recordUpdate(op, 'ok', durationMs);
  }

  private toResponse(t: TaskRow, hoursPerDay?: number): TaskResponse {
    const hpd = hoursPerDay && hoursPerDay > 0 ? hoursPerDay : 8;
    return {
      id: t.id.toString(),
      projectId: t.projectId.toString(),
      parentId: t.parentId?.toString() ?? null,
      assigneeId: t.assigneeId?.toString() ?? null,
      name: t.name,
      description: t.description,
      startDate: t.startDate.toISOString(),
      endDate: t.endDate.toISOString(),
      duration: t.duration.toString(),
      progress: t.progress,
      priority: priorityToWire(t.priority as any),
      status: statusToWire(t.status as any),
      type: t.type as any,
      color: t.color,
      order: t.order.toString(),
      open: t.open,
      tags: t.tags,
      estimatedHours: t.estimatedHours.toString(),
      actualHours: t.actualHours?.toString() ?? null,
      hoursPerDay: hpd.toFixed(2),
      version: t.version,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  private toMutationResponse(
    t: TaskRow,
    hoursPerDay: number | undefined,
    summariesPatched: SummaryPatch[],
  ): TaskMutationResponse {
    return {
      ...this.toResponse(t, hoursPerDay),
      summariesPatched,
    };
  }

  private planTaskUpdate(dto: UpdateTaskDto): TaskUpdatePlan {
    const scheduleTouched =
      dto.startDate !== undefined ||
      dto.endDate !== undefined ||
      dto.type !== undefined ||
      dto.estimatedHours !== undefined;
    const workloadTouched = scheduleTouched || dto.assigneeId !== undefined;
    const summariesTouched =
      scheduleTouched ||
      dto.progress !== undefined ||
      dto.parentId !== undefined;
    const versioned =
      dto.name !== undefined ||
      dto.description !== undefined ||
      scheduleTouched ||
      dto.priority !== undefined ||
      dto.status !== undefined ||
      dto.type !== undefined ||
      dto.color !== undefined ||
      dto.assigneeId !== undefined ||
      dto.parentId !== undefined ||
      dto.progress !== undefined;

    return { scheduleTouched, workloadTouched, summariesTouched, versioned };
  }

  private async computeWorkloadFromCurrentRange(
    projectId: bigint,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    hoursPerDay: number;
    workload: ScheduledSlot[];
  }> {
    const calendar = await this.calendarResolver.resolveForProject(projectId);
    if (endDate.getTime() <= startDate.getTime()) {
      return { hoursPerDay: calendar.hoursPerDay || 8, workload: [] };
    }
    const result = this.scheduling.scheduleFromRange({
      startDateTime: startDate,
      endDateTime: endDate,
      calendar,
    });
    return {
      hoursPerDay: calendar.hoursPerDay || 8,
      workload: result.workload,
    };
  }

  private async computeSchedule(
    projectId: bigint,
    type: string,
    rawStart: Date,
    rawEnd: Date | undefined,
    estimatedHoursRaw?: string,
  ): Promise<{
    startDate: Date;
    endDate: Date;
    duration: string;
    estimatedHours?: string;
    hoursPerDay: number;
    workload: ScheduledSlot[];
  }> {
    const calendar = await this.calendarResolver.resolveForProject(projectId);
    return this.scheduleCalculator.calculate(
      calendar,
      type,
      rawStart,
      rawEnd,
      estimatedHoursRaw,
    );
  }

  private async regenerateWorkload(
    tx: Prisma.TransactionClient,
    taskId: bigint,
    projectId: bigint,
    assigneeId: bigint | null,
    workload: ScheduledSlot[],
  ): Promise<void> {
    await tx.workload.deleteMany({ where: { taskId } });
    if (!assigneeId || workload.length === 0) return;
    await tx.workload.createMany({
      data: workload.map((slot) => ({
        userId: assigneeId,
        taskId,
        projectId,
        date: slot.date,
        allocatedHours: new Prisma.Decimal(slot.allocatedHours.toFixed(2)),
      })),
      skipDuplicates: true,
    });
  }

  private isVersionConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }

  private async assertVersionConflict(
    id: bigint,
    expectedVersion: number,
    op: string,
  ): Promise<never> {
    const current = await this.prisma.task.findUnique({
      where: { id },
      select: { version: true },
    });
    this.logger?.warn(
      {
        op,
        taskId: id.toString(),
        expectedVersion,
        currentVersion: current?.version ?? null,
      },
      'task version conflict',
    );
    this.metrics?.recordConflict(op);
    throw new ConflictException({
      code: 'TASK_VERSION_STALE',
      message: 'task has been modified by another request',
      currentVersion: current?.version ?? null,
    });
  }

  private async assertProjectAccess(
    projectId: bigint,
    user: AuthUser,
  ): Promise<void> {
    if (user.role === 'admin') return;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project) throw new NotFoundException('project not found');
    if (project.ownerId === user.id) return;

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!membership) throw new ForbiddenException('not a project member');
  }

  private async assertTaskAccess(
    taskId: bigint,
    user: AuthUser,
  ): Promise<TaskRow> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('task not found');
    await this.assertProjectAccess(task.projectId, user);
    return task;
  }

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return date;
  }

  private parseBigInt(value: string, field: string): bigint {
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(`${field} must be a valid id`);
    }
  }

  private async resolveAssigneeId(
    assigneeId?: string,
  ): Promise<bigint | null | undefined> {
    if (assigneeId === undefined) return undefined;
    if (!assigneeId) return null;

    const id = this.parseBigInt(assigneeId, 'assigneeId');
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user)
      throw new BadRequestException(
        'assigneeId must reference an existing user',
      );
    return id;
  }

  private async validateParent(
    projectId: bigint,
    taskId: bigint | null,
    parentId?: string | null,
  ): Promise<bigint | null | undefined> {
    if (parentId === undefined) return undefined;
    if (parentId === null || parentId === '') return null;

    const newParentId = this.parseBigInt(parentId, 'parentId');
    if (taskId !== null && newParentId === taskId) {
      throw new BadRequestException('parentId cannot be the task itself');
    }

    const newParent = await this.prisma.task.findUnique({
      where: { id: newParentId },
      select: { projectId: true, parentId: true },
    });
    if (!newParent || newParent.projectId !== projectId) {
      throw new BadRequestException(
        'parentId must be a task in the same project',
      );
    }

    let cursor: bigint | null = newParent.parentId;
    while (cursor !== null) {
      if (taskId !== null && cursor === taskId) {
        throw new BadRequestException('parentId would create a cycle');
      }
      const ancestor = await this.prisma.task.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = ancestor?.parentId ?? null;
    }

    return newParentId;
  }

  private async resolveNeighborOrders(
    projectId: bigint,
    afterTaskId?: string,
    beforeTaskId?: string,
  ): Promise<string> {
    let afterOrder: string | null = null;
    let beforeOrder: string | null = null;

    if (afterTaskId) {
      const t = await this.prisma.task.findUnique({
        where: { id: this.parseBigInt(afterTaskId, 'afterTaskId') },
      });
      if (!t || t.projectId !== projectId) {
        throw new BadRequestException(
          'afterTaskId must be a task in the same project',
        );
      }
      afterOrder = t.order.toString();
    }

    if (beforeTaskId) {
      const t = await this.prisma.task.findUnique({
        where: { id: this.parseBigInt(beforeTaskId, 'beforeTaskId') },
      });
      if (!t || t.projectId !== projectId) {
        throw new BadRequestException(
          'beforeTaskId must be a task in the same project',
        );
      }
      beforeOrder = t.order.toString();
    }

    if (afterTaskId && beforeTaskId && afterTaskId === beforeTaskId) {
      throw new BadRequestException(
        'afterTaskId and beforeTaskId must be different tasks',
      );
    }

    if (afterOrder === null && beforeOrder === null) {
      const last = await this.prisma.task.findFirst({
        where: { projectId },
        orderBy: { order: 'desc' },
      });
      return last ? after(last.order.toString()) : firstOrder();
    }

    if (afterOrder !== null && beforeOrder === null) {
      return after(afterOrder);
    }

    try {
      return between(afterOrder, beforeOrder);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'invalid order bounds',
      );
    }
  }

  async list(projectId: bigint): Promise<TaskResponse[]> {
    const [tasks, calendar] = await Promise.all([
      this.prisma.task.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
      }),
      this.calendarResolver.resolveForProject(projectId),
    ]);
    return tasks.map((t) => this.toResponse(t, calendar.hoursPerDay));
  }

  async create(projectId: bigint, dto: CreateTaskDto): Promise<TaskResponse> {
    const startedAt = Date.now();
    const parentId = await this.validateParent(projectId, null, dto.parentId);
    const assigneeId = await this.resolveAssigneeId(dto.assigneeId);
    const order = await this.resolveNeighborOrders(projectId, dto.afterTaskId);
    const schedule = await this.computeSchedule(
      projectId,
      dto.type,
      this.parseDate(dto.startDate, 'startDate'),
      dto.endDate ? this.parseDate(dto.endDate, 'endDate') : undefined,
      dto.estimatedHours,
    );

    const refreshed = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.task.create({
          data: {
            projectId,
            parentId: parentId ?? null,
            assigneeId: assigneeId ?? null,
            name: dto.name,
            description: dto.description ?? null,
            startDate: schedule.startDate,
            endDate: schedule.endDate,
            duration: schedule.duration,
            ...(schedule.estimatedHours !== undefined && {
              estimatedHours: new Prisma.Decimal(schedule.estimatedHours),
            }),
            priority: priorityToPrisma(dto.priority),
            status: statusToPrisma(dto.status),
            type: dto.type as any,
            color: dto.color,
            order,
          },
        });
        if (schedule.workload.length > 0) {
          await this.regenerateWorkload(
            tx,
            created.id,
            projectId,
            assigneeId ?? null,
            schedule.workload,
          );
        }
        await this.summaries.recalculate(projectId, tx);
        return tx.task.findUnique({ where: { id: created.id } }) ?? created;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );

    this.logOp(
      'create',
      { projectId: projectId.toString(), taskId: refreshed!.id.toString() },
      Date.now() - startedAt,
    );
    return this.toResponse(refreshed!, schedule.hoursPerDay);
  }

  async getById(id: bigint, user: AuthUser): Promise<TaskResponse> {
    const task = await this.assertTaskAccess(id, user);
    const calendar = await this.calendarResolver.resolveForProject(
      task.projectId,
    );
    return this.toResponse(task, calendar.hoursPerDay);
  }

  async update(
    id: bigint,
    dto: UpdateTaskDto,
    user: AuthUser,
  ): Promise<TaskMutationResponse> {
    const startedAt = Date.now();
    const existing = await this.assertTaskAccess(id, user);
    const plan = this.planTaskUpdate(dto);
    const nextType = dto.type ?? (existing.type as any);
    const schedule = plan.scheduleTouched
      ? await this.computeSchedule(
          existing.projectId,
          nextType,
          dto.startDate
            ? this.parseDate(dto.startDate, 'startDate')
            : existing.startDate,
          dto.endDate
            ? this.parseDate(dto.endDate, 'endDate')
            : dto.estimatedHours
              ? undefined
              : existing.endDate,
          dto.estimatedHours,
        )
      : null;
    const workloadOnly =
      !schedule && plan.workloadTouched
        ? await this.computeWorkloadFromCurrentRange(
            existing.projectId,
            existing.startDate,
            existing.endDate,
          )
        : null;

    const parentId = await this.validateParent(
      existing.projectId,
      id,
      dto.parentId,
    );
    const assigneeId = await this.resolveAssigneeId(dto.assigneeId);
    const finalAssigneeId =
      assigneeId !== undefined ? assigneeId : existing.assigneeId;

    const where =
      dto.expectedVersion !== undefined
        ? { id, version: dto.expectedVersion }
        : { id };

    let refreshed: TaskRow;
    let summariesPatched: SummaryPatch[] = [];
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const updated = await tx.task.update({
            where,
            data: {
              ...(dto.name !== undefined && { name: dto.name }),
              ...(dto.description !== undefined && {
                description: dto.description,
              }),
              ...(schedule && {
                startDate: schedule.startDate,
                endDate: schedule.endDate,
                duration: schedule.duration,
                ...(schedule.estimatedHours !== undefined && {
                  estimatedHours: new Prisma.Decimal(schedule.estimatedHours),
                }),
              }),
              ...(dto.progress !== undefined && { progress: dto.progress }),
              ...(dto.priority !== undefined && {
                priority: priorityToPrisma(dto.priority),
              }),
              ...(dto.status !== undefined && {
                status: statusToPrisma(dto.status),
              }),
              ...(dto.type !== undefined && { type: dto.type as any }),
              ...(dto.color !== undefined && { color: dto.color }),
              ...(assigneeId !== undefined && { assigneeId }),
              ...(dto.open !== undefined && { open: dto.open }),
              ...(parentId !== undefined && { parentId }),
              ...(plan.versioned && { version: { increment: 1 } }),
            },
          });
          const workload = schedule?.workload ?? workloadOnly?.workload;
          if (plan.workloadTouched && workload !== undefined) {
            await this.regenerateWorkload(
              tx,
              id,
              existing.projectId,
              finalAssigneeId ?? null,
              workload,
            );
          }
          const patched = plan.summariesTouched
            ? await this.summaries.recalculate(existing.projectId, tx)
            : [];
          const fresh =
            (await tx.task.findUnique({ where: { id } })) ?? updated;
          // DEBUG-WRITE-PERSIST (temporal): ¿update y el findUnique ven lo mismo DENTRO de la tx?
          this.logger?.warn(
            {
              dbg: 'update-tx',
              id: id.toString(),
              whereVersion: (where as { version?: number }).version ?? null,
              updated: { progress: updated.progress, version: updated.version },
              fresh: { progress: fresh.progress, version: fresh.version },
            },
            'DEBUG-WRITE-PERSIST',
          );
          return { fresh, patched };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10000,
        },
      );
      refreshed = result.fresh;
      summariesPatched = result.patched;
    } catch (err) {
      if (dto.expectedVersion !== undefined && this.isVersionConflict(err)) {
        return this.assertVersionConflict(id, dto.expectedVersion, 'update');
      }
      throw err;
    }

    this.logOp(
      'update',
      {
        projectId: existing.projectId.toString(),
        taskId: id.toString(),
        fields: Object.keys(dto),
      },
      Date.now() - startedAt,
    );
    const hoursPerDay =
      schedule?.hoursPerDay ??
      workloadOnly?.hoursPerDay ??
      (await this.calendarResolver.resolveForProject(existing.projectId))
        .hoursPerDay;
    return this.toMutationResponse(refreshed!, hoursPerDay, summariesPatched);
  }

  async updateProgress(
    id: bigint,
    dto: UpdateProgressDto,
    user: AuthUser,
  ): Promise<TaskMutationResponse> {
    const startedAt = Date.now();
    const existing = await this.assertTaskAccess(id, user);
    const where =
      dto.expectedVersion !== undefined
        ? { id, version: dto.expectedVersion }
        : { id };

    let refreshed: TaskRow;
    let summariesPatched: SummaryPatch[] = [];
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const updated = await tx.task.update({
            where,
            data: { progress: dto.progress, version: { increment: 1 } },
          });
          const patched = await this.summaries.recalculate(
            existing.projectId,
            tx,
          );
          const fresh =
            (await tx.task.findUnique({ where: { id } })) ?? updated;
          return { fresh, patched };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10000,
        },
      );
      refreshed = result.fresh;
      summariesPatched = result.patched;
    } catch (err) {
      if (dto.expectedVersion !== undefined && this.isVersionConflict(err)) {
        return this.assertVersionConflict(
          id,
          dto.expectedVersion,
          'updateProgress',
        );
      }
      throw err;
    }

    this.logOp(
      'updateProgress',
      {
        projectId: existing.projectId.toString(),
        taskId: id.toString(),
        progress: dto.progress,
      },
      Date.now() - startedAt,
    );
    const calendar = await this.calendarResolver.resolveForProject(
      existing.projectId,
    );
    return this.toMutationResponse(
      refreshed!,
      calendar.hoursPerDay,
      summariesPatched,
    );
  }

  async updateOrder(
    id: bigint,
    dto: UpdateOrderDto,
    user: AuthUser,
  ): Promise<TaskMutationResponse> {
    const startedAt = Date.now();
    const existing = await this.assertTaskAccess(id, user);
    const order = await this.resolveNeighborOrders(
      existing.projectId,
      dto.afterTaskId,
      dto.beforeTaskId,
    );
    const where =
      dto.expectedVersion !== undefined
        ? { id, version: dto.expectedVersion }
        : { id };

    let updated;
    try {
      updated = await this.prisma.$transaction(
        async (tx) => {
          return tx.task.update({
            where,
            data: { order, version: { increment: 1 } },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10000,
        },
      );
    } catch (err) {
      if (dto.expectedVersion !== undefined && this.isVersionConflict(err)) {
        return this.assertVersionConflict(
          id,
          dto.expectedVersion,
          'updateOrder',
        );
      }
      throw err;
    }

    this.logOp(
      'updateOrder',
      { projectId: existing.projectId.toString(), taskId: id.toString() },
      Date.now() - startedAt,
    );
    const calendar = await this.calendarResolver.resolveForProject(
      existing.projectId,
    );
    return this.toMutationResponse(updated, calendar.hoursPerDay, []);
  }

  async updatePosition(
    id: bigint,
    dto: UpdateTaskPositionDto,
    user: AuthUser,
  ): Promise<TaskMutationResponse> {
    const startedAt = Date.now();
    const existing = await this.assertTaskAccess(id, user);
    const parentId = await this.validateParent(
      existing.projectId,
      id,
      dto.parentId,
    );
    const order = await this.resolveNeighborOrders(
      existing.projectId,
      dto.afterTaskId,
      dto.beforeTaskId,
    );
    const where =
      dto.expectedVersion !== undefined
        ? { id, version: dto.expectedVersion }
        : { id };
    const parentChanged =
      parentId !== undefined && parentId !== existing.parentId;

    let updated: TaskRow;
    let summariesPatched: SummaryPatch[] = [];
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const task = await tx.task.update({
            where,
            data: {
              order,
              ...(parentId !== undefined && { parentId }),
              version: { increment: 1 },
            },
          });
          const patched = parentChanged
            ? await this.summaries.recalculate(existing.projectId, tx)
            : [];
          return { task, patched };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10000,
        },
      );
      updated = result.task;
      summariesPatched = result.patched;
    } catch (err) {
      if (dto.expectedVersion !== undefined && this.isVersionConflict(err)) {
        return this.assertVersionConflict(
          id,
          dto.expectedVersion,
          'updatePosition',
        );
      }
      throw err;
    }

    this.logOp(
      'updatePosition',
      { projectId: existing.projectId.toString(), taskId: id.toString() },
      Date.now() - startedAt,
    );
    const calendar = await this.calendarResolver.resolveForProject(
      existing.projectId,
    );
    return this.toMutationResponse(
      updated!,
      calendar.hoursPerDay,
      summariesPatched,
    );
  }

  async updateOpenStates(
    projectId: bigint,
    dto: BulkTaskOpenStateDto,
    user: AuthUser,
  ): Promise<BulkTaskOpenStateResponse> {
    const startedAt = Date.now();
    await this.assertProjectAccess(projectId, user);

    const ids = dto.states.map((s) => this.parseBigInt(s.id, 'id'));
    const owned = await this.prisma.task.findMany({
      where: { id: { in: ids }, projectId },
      select: { id: true, version: true },
    });
    if (owned.length !== ids.length) {
      throw new BadRequestException(
        'one or more tasks do not belong to this project',
      );
    }
    const versionById = new Map(
      owned.map((t) => [t.id.toString(), t.version] as const),
    );

    const updated: Array<{ id: string; open: boolean; version: number }> = [];
    const conflicts: BulkTaskOpenStateConflict[] = [];

    await this.prisma.$transaction(
      async (tx) => {
        for (const state of dto.states) {
          const taskId = this.parseBigInt(state.id, 'id');
          if (state.expectedVersion !== undefined) {
            const res = await tx.task.updateMany({
              where: { id: taskId, version: state.expectedVersion },
              data: { open: state.open, version: { increment: 1 } },
            });
            if (res.count === 0) {
              conflicts.push({
                id: state.id,
                currentVersion: versionById.get(state.id) ?? 0,
                expectedVersion: state.expectedVersion,
              });
              continue;
            }
            updated.push({
              id: state.id,
              open: state.open,
              version: state.expectedVersion + 1,
            });
          } else {
            const res = await tx.task.update({
              where: { id: taskId },
              data: { open: state.open, version: { increment: 1 } },
              select: { version: true },
            });
            updated.push({
              id: state.id,
              open: state.open,
              version: res.version,
            });
          }
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );

    this.logOp(
      'openStates',
      {
        projectId: projectId.toString(),
        count: dto.states.length,
        conflicts: conflicts.length,
      },
      Date.now() - startedAt,
    );

    return conflicts.length > 0 ? { updated, conflicts } : { updated };
  }

  async remove(id: bigint, user: AuthUser): Promise<void> {
    const startedAt = Date.now();
    const existing = await this.assertTaskAccess(id, user);
    await this.prisma.$transaction(
      async (tx) => {
        await tx.task.delete({ where: { id } });
        await this.summaries.recalculate(existing.projectId, tx);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );

    this.logOp(
      'remove',
      { projectId: existing.projectId.toString(), taskId: id.toString() },
      Date.now() - startedAt,
    );
  }

  async previewPropagation(
    sourceTaskId: bigint,
    user: AuthUser,
  ): Promise<PropagationPreview> {
    const source = await this.assertTaskAccess(sourceTaskId, user);

    const allLinks = await this.prisma.taskLink.findMany({
      where: { projectId: source.projectId },
      select: { sourceTaskId: true, targetTaskId: true, type: true },
    });
    const linksBySource = new Map<string, typeof allLinks>();
    for (const link of allLinks) {
      const key = link.sourceTaskId.toString();
      linksBySource.set(key, [...(linksBySource.get(key) ?? []), link]);
    }

    const allTaskIds = new Set<string>();
    for (const l of allLinks) {
      allTaskIds.add(l.sourceTaskId.toString());
      allTaskIds.add(l.targetTaskId.toString());
    }
    allTaskIds.add(sourceTaskId.toString());
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: Array.from(allTaskIds).map((id) => BigInt(id)) } },
      select: {
        id: true,
        projectId: true,
        startDate: true,
        endDate: true,
        version: true,
      },
    });
    const taskById = new Map(tasks.map((t) => [t.id.toString(), t]));

    const proposed = new Map<
      string,
      {
        startDate: Date;
        endDate: Date;
        via: PropagationChange['via'];
        fromTaskId: string;
      }
    >();
    const queue: string[] = [sourceTaskId.toString()];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentProposed = proposed.get(currentId);
      const currentTask = taskById.get(currentId);
      if (!currentTask) continue;

      const currentStart = currentProposed?.startDate ?? currentTask.startDate;
      const currentEnd = currentProposed?.endDate ?? currentTask.endDate;

      const outgoing = linksBySource.get(currentId) ?? [];
      for (const link of outgoing) {
        const targetId = link.targetTaskId.toString();
        if (targetId === sourceTaskId.toString()) continue;
        const targetTask = taskById.get(targetId);
        if (!targetTask) continue;

        const targetStart =
          proposed.get(targetId)?.startDate ?? targetTask.startDate;
        const targetEnd = proposed.get(targetId)?.endDate ?? targetTask.endDate;
        const durationMs = targetEnd.getTime() - targetStart.getTime();

        let newStart = targetStart;
        let newEnd = targetEnd;
        switch (link.type) {
          case 'e2s':
            newStart = new Date(currentEnd);
            newEnd = new Date(newStart.getTime() + durationMs);
            break;
          case 's2s':
            newStart = new Date(currentStart);
            newEnd = new Date(newStart.getTime() + durationMs);
            break;
          case 'e2e':
            newEnd = new Date(currentEnd);
            newStart = new Date(newEnd.getTime() - durationMs);
            break;
          case 's2e':
            newEnd = new Date(currentStart);
            newStart = new Date(newEnd.getTime() - durationMs);
            break;
        }

        if (
          newStart.getTime() === targetStart.getTime() &&
          newEnd.getTime() === targetEnd.getTime()
        ) {
          continue;
        }

        proposed.set(targetId, {
          startDate: newStart,
          endDate: newEnd,
          via: link.type as PropagationChange['via'],
          fromTaskId: currentId,
        });
        queue.push(targetId);
      }
    }

    const changes: PropagationChange[] = [];
    for (const [taskId, p] of proposed.entries()) {
      const task = taskById.get(taskId)!;
      changes.push({
        taskId,
        currentVersion: task.version,
        currentStartDate: task.startDate.toISOString().slice(0, 10),
        currentEndDate: task.endDate.toISOString().slice(0, 10),
        proposedStartDate: p.startDate.toISOString().slice(0, 10),
        proposedEndDate: p.endDate.toISOString().slice(0, 10),
        via: p.via,
        fromTaskId: p.fromTaskId,
      });
    }

    return { sourceTaskId: sourceTaskId.toString(), changes };
  }

  async applyPropagation(
    sourceTaskId: bigint,
    dto: ApplyPropagationDto,
    user: AuthUser,
  ): Promise<BulkTaskUpdateResponse> {
    const source = await this.assertTaskAccess(sourceTaskId, user);
    return this.bulkUpdate(
      source.projectId,
      {
        updates: dto.changes.map((c) => ({
          id: c.taskId,
          expectedVersion: c.expectedVersion,
          data: { startDate: c.startDate, endDate: c.endDate },
        })),
      },
      user,
    );
  }

  async bulkUpdate(
    projectId: bigint,
    dto: BulkTaskUpdateDto,
    user: AuthUser,
  ): Promise<BulkTaskUpdateResponse> {
    const startedAt = Date.now();
    await this.assertProjectAccess(projectId, user);

    const ids = dto.updates.map((u) => this.parseBigInt(u.id, 'id'));
    const owned = await this.prisma.task.findMany({
      where: { id: { in: ids }, projectId },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new BadRequestException(
        'one or more tasks do not belong to this project',
      );
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const updatedTasks: TaskRow[] = [];
        let summariesDirty = false;
        for (const item of dto.updates) {
          const itemId = this.parseBigInt(item.id, 'id');
          const data = item.data;
          const plan = this.planTaskUpdate(data);
          const expectedVersion = item.expectedVersion ?? data.expectedVersion;
          const where =
            expectedVersion !== undefined
              ? { id: itemId, version: expectedVersion }
              : { id: itemId };
          const existing = await tx.task.findUnique({ where: { id: itemId } });
          if (!existing) {
            throw new NotFoundException(`task ${item.id} not found`);
          }

          const nextType = data.type ?? (existing.type as any);
          const schedule = plan.scheduleTouched
            ? await this.computeSchedule(
                existing.projectId,
                nextType,
                data.startDate
                  ? this.parseDate(data.startDate, 'startDate')
                  : existing.startDate,
                data.endDate
                  ? this.parseDate(data.endDate, 'endDate')
                  : data.estimatedHours
                    ? undefined
                    : existing.endDate,
                data.estimatedHours,
              )
            : null;
          const workloadOnly =
            !schedule && plan.workloadTouched
              ? await this.computeWorkloadFromCurrentRange(
                  existing.projectId,
                  existing.startDate,
                  existing.endDate,
                )
              : null;
          const parentId = await this.validateParent(
            existing.projectId,
            itemId,
            data.parentId,
          );
          const assigneeId = await this.resolveAssigneeId(data.assigneeId);
          const finalAssigneeId =
            assigneeId !== undefined ? assigneeId : existing.assigneeId;

          try {
            const updated = await tx.task.update({
              where,
              data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.description !== undefined && {
                  description: data.description,
                }),
                ...(schedule && {
                  startDate: schedule.startDate,
                  endDate: schedule.endDate,
                  duration: schedule.duration,
                  ...(schedule.estimatedHours !== undefined && {
                    estimatedHours: new Prisma.Decimal(schedule.estimatedHours),
                  }),
                }),
                ...(data.progress !== undefined && { progress: data.progress }),
                ...(data.priority !== undefined && {
                  priority: priorityToPrisma(data.priority),
                }),
                ...(data.status !== undefined && {
                  status: statusToPrisma(data.status),
                }),
                ...(data.type !== undefined && { type: data.type as any }),
                ...(data.color !== undefined && { color: data.color }),
                ...(assigneeId !== undefined && { assigneeId }),
                ...(data.open !== undefined && { open: data.open }),
                ...(parentId !== undefined && { parentId }),
                ...(plan.versioned && { version: { increment: 1 } }),
              },
            });
            const workload = schedule?.workload ?? workloadOnly?.workload;
            if (plan.workloadTouched && workload !== undefined) {
              await this.regenerateWorkload(
                tx,
                itemId,
                existing.projectId,
                finalAssigneeId ?? null,
                workload,
              );
            }
            summariesDirty = summariesDirty || plan.summariesTouched;
            updatedTasks.push(updated);
          } catch (err) {
            if (expectedVersion !== undefined && this.isVersionConflict(err)) {
              await this.assertVersionConflict(
                itemId,
                expectedVersion,
                'bulkUpdate',
              );
            }
            throw err;
          }
        }

        const summariesPatched = summariesDirty
          ? await this.summaries.recalculate(projectId, tx)
          : [];
        return { tasks: updatedTasks, summariesPatched };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 30000,
      },
    );

    this.logOp(
      'bulkUpdate',
      {
        projectId: projectId.toString(),
        count: dto.updates.length,
        summariesChanged: result.summariesPatched.length,
      },
      Date.now() - startedAt,
    );

    const calendar = await this.calendarResolver.resolveForProject(projectId);
    return {
      tasks: result.tasks.map((t) => this.toResponse(t, calendar.hoursPerDay)),
      summariesPatched: result.summariesPatched,
    };
  }
}
