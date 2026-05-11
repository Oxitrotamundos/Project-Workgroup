import { useMemo } from 'react';
import type { Task } from '../../types/domain';

export interface TaskStats {
  total: number;
  inProgress: number;
  done: number;
  blocked: number;
  totalHours: number;
}

export const useTaskStats = (tasks: Task[]): TaskStats =>
  useMemo(() => {
    let totalHours = 0;
    let done = 0;
    let blocked = 0;
    let inProgress = 0;
    for (const t of tasks) {
      totalHours += t.estimatedHours ?? 0;
      if (t.status === 'completed') done += 1;
      else if (t.status === 'blocked') blocked += 1;
      else if (t.status === 'in-progress') inProgress += 1;
    }
    return { total: tasks.length, inProgress, done, blocked, totalHours };
  }, [tasks]);
