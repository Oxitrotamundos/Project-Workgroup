import type { SummaryPatch } from '@project-workgroup/shared';
import type { Task } from '../types/domain';

const toNumeric = (raw: string | number | undefined, fallback: number): number => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : fallback;
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const mergeSummaryPatchIntoTask = (task: Task, patch: SummaryPatch): Task => ({
  ...task,
  startDate: patch.startDate,
  endDate: patch.endDate,
  duration: toNumeric(patch.duration, task.duration),
  progress: patch.progress,
  estimatedHours: toNumeric(patch.estimatedHours, task.estimatedHours),
  version: patch.version,
});

export const applySummaryPatches = (
  tasks: Task[] | undefined,
  patches: SummaryPatch[] | undefined,
): Task[] | undefined => {
  if (!tasks) return tasks;
  if (!patches || patches.length === 0) return tasks;
  const byId = new Map(patches.map((patch) => [patch.id, patch]));
  return tasks.map((task) => {
    const patch = byId.get(task.id);
    return patch ? mergeSummaryPatchIntoTask(task, patch) : task;
  });
};
