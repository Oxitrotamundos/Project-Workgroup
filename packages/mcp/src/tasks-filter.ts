import type { TaskResponse } from '@project-workgroup/shared';

export interface TaskFilter {
  status?: string;
  type?: string;
  assigneeId?: string;
  from?: string; // límite inferior: excluye tareas que terminan antes
  to?: string; // límite superior: excluye tareas que empiezan después
}

// Filtro puro en memoria. La ventana [from,to] selecciona tareas que solapan el rango.
export function filterTasks(
  tasks: TaskResponse[],
  f: TaskFilter,
): TaskResponse[] {
  const fromMs = f.from ? new Date(f.from).getTime() : undefined;
  const toMs = f.to ? new Date(f.to).getTime() : undefined;
  return tasks.filter((t) => {
    if (f.status && t.status !== f.status) return false;
    if (f.type && t.type !== f.type) return false;
    if (f.assigneeId && t.assigneeId !== f.assigneeId) return false;
    if (fromMs !== undefined && new Date(t.endDate).getTime() < fromMs)
      return false;
    if (toMs !== undefined && new Date(t.startDate).getTime() > toMs)
      return false;
    return true;
  });
}
