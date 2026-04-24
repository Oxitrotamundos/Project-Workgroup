import { TaskStatus, TaskPriority } from '@project-workgroup/shared';
import { TaskStatus as PrismaTaskStatus, TaskPriority as PrismaTaskPriority } from '../generated/prisma/client';

/** Wire status (not-started) → Prisma (not_started) */
export function statusToPrisma(s: TaskStatus): PrismaTaskStatus {
  return s.replace('-', '_') as PrismaTaskStatus;
}

/** Prisma status (not_started) → Wire (not-started) */
export function statusToWire(s: PrismaTaskStatus): TaskStatus {
  return s.replace('_', '-') as TaskStatus;
}

/** Priority is the same in both (no hyphens/underscores) */
export function priorityToPrisma(p: TaskPriority): PrismaTaskPriority {
  return p as PrismaTaskPriority;
}

export function priorityToWire(p: PrismaTaskPriority): TaskPriority {
  return p as TaskPriority;
}
