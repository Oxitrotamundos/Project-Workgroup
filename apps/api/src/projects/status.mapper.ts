import { ProjectStatus as PrismaProjectStatus } from '../generated/prisma/client';
import { ProjectStatus } from '@project-workgroup/shared';

export function toPrisma(status: ProjectStatus): PrismaProjectStatus {
  return (status === 'on-hold' ? 'on_hold' : status) as PrismaProjectStatus;
}

export function toWire(status: PrismaProjectStatus): ProjectStatus {
  return (status === 'on_hold' ? 'on-hold' : status) as ProjectStatus;
}
