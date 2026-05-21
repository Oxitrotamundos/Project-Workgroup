import { TaskStatus, TaskPriority } from '@project-workgroup/shared';
import {
  TaskStatus as PrismaTaskStatus,
  TaskPriority as PrismaTaskPriority,
} from '../generated/prisma/client';

export function statusToPrisma(s: TaskStatus): PrismaTaskStatus {
  return s.replace('-', '_') as PrismaTaskStatus;
}

export function statusToWire(s: PrismaTaskStatus): TaskStatus {
  return s.replace('_', '-') as TaskStatus;
}

export function priorityToPrisma(p: TaskPriority): PrismaTaskPriority {
  return p as PrismaTaskPriority;
}

export function priorityToWire(p: PrismaTaskPriority): TaskPriority {
  return p as TaskPriority;
}
