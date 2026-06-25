import { apiClient, ApiError } from '../lib/apiClient';
import type {
  Task,
  CreateTaskData,
  TaskFilters,
  TaskType
} from '../types/domain';
import type {
  BulkTaskOpenStateResponse,
  BulkTaskUpdateResponse,
  PropagationPreview,
  SummaryPatch,
  TaskMutationResponse,
  TaskResponse,
  UpdateTaskPositionDto,
  UpdateTaskDto,
} from '@project-workgroup/shared';

// Extiende TaskResponse para cubrir el campo `dependencies` que el dominio requiere
// pero que la API no incluye explícitamente en su contrato tipado.
type RawTask = TaskResponse & { dependencies?: string[] };

export interface BulkUpdateItem {
  id: string;
  data: UpdateTaskDto;
  expectedVersion?: number;
}

export interface BulkUpdateResult {
  tasks: Task[];
  summariesPatched: SummaryPatch[];
}

export interface TaskMutationResult {
  task: Task;
  summariesPatched: SummaryPatch[];
}

const toNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toDomain = (r: RawTask): Task => ({
  id: r.id,
  projectId: r.projectId,
  name: r.name,
  description: r.description ?? undefined,
  startDate: r.startDate ?? '',
  endDate: r.endDate ?? '',
  duration: toNumber(r.duration, 1),
  progress: r.progress ?? 0,
  assigneeId: r.assigneeId ?? undefined,
  parentId: r.parentId ?? undefined,
  dependencies: r.dependencies ?? [],
  tags: r.tags ?? [],
  priority: r.priority ?? 'medium',
  color: r.color ?? '#3B82F6',
  estimatedHours: toNumber(r.estimatedHours, 0),
  actualHours: r.actualHours === null || r.actualHours === undefined ? undefined : toNumber(r.actualHours, 0),
  hoursPerDay: r.hoursPerDay !== undefined ? toNumber(r.hoursPerDay, 8) : undefined,
  status: r.status ?? 'not-started',
  type: r.type ?? 'task',
  order: toNumber(r.order, 0),
  open: r.open ?? true,
  version: typeof r.version === 'number' ? r.version : undefined,
  createdAt: r.createdAt ?? '',
  updatedAt: r.updatedAt ?? '',
});

const toMutationResult = (r: TaskMutationResponse): TaskMutationResult => ({
  task: toDomain(r),
  summariesPatched: Array.isArray(r?.summariesPatched) ? r.summariesPatched : [],
});

export class TaskService {
  static async getNextOrderForProject(projectId: string): Promise<number> {
    try {
      const tasks = await this.getProjectTasks(projectId);
      if (tasks.length === 0) return 1;
      const maxOrder = Math.max(...tasks.map(task => task.order || 0));
      return maxOrder + 1;
    } catch (error) {
      console.error('Error getting next order:', error);
      return 1;
    }
  }

  static async createTask(data: CreateTaskData): Promise<string> {
    const body: Record<string, unknown> = {
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      priority: data.priority,
      status: data.status,
      type: data.type,
      color: data.color,
    };
    if (data.endDate) body.endDate = data.endDate;
    if (data.parentId) body.parentId = data.parentId;
    if (data.assigneeId) body.assigneeId = data.assigneeId;
    if (data.estimatedHours !== undefined && data.estimatedHours !== null && data.estimatedHours > 0) {
      body.estimatedHours = String(data.estimatedHours);
    }

    const result = await apiClient.post<TaskResponse>(`/v1/projects/${data.projectId}/tasks`, body);
    return result.id;
  }

  static async getTask(id: string): Promise<Task | null> {
    try {
      const result = await apiClient.get<RawTask>(`/v1/tasks/${id}`);
      return toDomain(result);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) return null;
      console.error('Error getting task:', error);
      throw new Error('Error al obtener la tarea');
    }
  }

  static async getProjectTasks(projectId: string, _filters?: TaskFilters): Promise<Task[]> {
    try {
      const result = await apiClient.get<RawTask[]>(`/v1/projects/${projectId}/tasks`);
      return result.map(toDomain);
    } catch (error) {
      console.error('Error getting project tasks:', error);
      return [];
    }
  }

  static async updateTask(id: string, data: UpdateTaskDto): Promise<Task> {
    return (await this.updateTaskWithMeta(id, data)).task;
  }

  static async updateTaskWithMeta(id: string, data: UpdateTaskDto): Promise<TaskMutationResult> {
    const result = await apiClient.enqueuePatch<TaskMutationResponse>(
      `/v1/tasks/${id}`,
      data as Record<string, unknown>,
    );
    return toMutationResult(result);
  }

  static async getDescendants(projectId: string, rootId: string): Promise<Task[]> {
    const all = await this.getProjectTasks(projectId);
    const childrenByParent = new Map<string, Task[]>();
    for (const t of all) {
      const pid = t.parentId ?? '';
      if (!pid) continue;
      const list = childrenByParent.get(pid) ?? [];
      list.push(t);
      childrenByParent.set(pid, list);
    }
    const out: Task[] = [];
    const stack = [rootId];
    while (stack.length) {
      const current = stack.pop()!;
      const kids = childrenByParent.get(current) ?? [];
      for (const k of kids) {
        out.push(k);
        stack.push(k.id);
      }
    }
    return out;
  }

  static async deleteTask(id: string): Promise<void> {
    await apiClient.delete(`/v1/tasks/${id}`);
  }

  static async getUserTasks(_userId: string, _filters?: TaskFilters): Promise<Task[]> {
    return [];
  }

  static async updateTaskProgress(id: string, progress: number, expectedVersion?: number): Promise<Task> {
    return (await this.updateTaskProgressWithMeta(id, progress, expectedVersion)).task;
  }

  static async updateTaskProgressWithMeta(
    id: string,
    progress: number,
    expectedVersion?: number,
  ): Promise<TaskMutationResult> {
    const body: Record<string, unknown> = { progress };
    if (typeof expectedVersion === 'number') body.expectedVersion = expectedVersion;
    const result = await apiClient.patch<TaskMutationResponse>(`/v1/tasks/${id}/progress`, body);
    return toMutationResult(result);
  }

  static async addTaskDependency(_taskId: string, _dependencyId: string): Promise<void> {
    throw new Error('addTaskDependency: pendiente de migración a TaskLinkService');
  }

  static async removeTaskDependency(_taskId: string, _dependencyId: string): Promise<void> {
    throw new Error('removeTaskDependency: pendiente de migración a TaskLinkService');
  }

  static async getTasksByType(projectId: string, _type: TaskType): Promise<Task[]> {
    return this.getProjectTasks(projectId);
  }

  static async updateTaskExpandState(taskId: string, isOpen: boolean): Promise<Task> {
    const result = await apiClient.patch<TaskResponse>(`/v1/tasks/${taskId}`, { open: isOpen });
    return toDomain(result);
  }

  static async updateOpenStates(
    projectId: string,
    states: Array<{ id: string; open: boolean; expectedVersion?: number }>,
  ): Promise<BulkTaskOpenStateResponse> {
    return apiClient.patch<BulkTaskOpenStateResponse>(
      `/v1/projects/${projectId}/tasks/open-states`,
      { states },
    );
  }

  static async bulkUpdate(projectId: string, updates: BulkUpdateItem[]): Promise<BulkUpdateResult> {
    const result = await apiClient.patch<BulkTaskUpdateResponse>(
      `/v1/projects/${projectId}/tasks/bulk`,
      { updates },
    );
    return {
      tasks: result.tasks.map(toDomain),
      summariesPatched: result.summariesPatched,
    };
  }

  static async previewPropagation(taskId: string): Promise<PropagationPreview> {
    return apiClient.post<PropagationPreview>(`/v1/tasks/${taskId}/propagate-dates/preview`, {});
  }

  static async applyPropagation(
    taskId: string,
    changes: Array<{ taskId: string; startDate: string; endDate: string; expectedVersion?: number }>,
  ): Promise<BulkUpdateResult> {
    const result = await apiClient.post<BulkTaskUpdateResponse>(
      `/v1/tasks/${taskId}/propagate-dates/apply`,
      { changes },
    );
    return {
      tasks: result.tasks.map(toDomain),
      summariesPatched: result.summariesPatched,
    };
  }

  static async updateTaskOrder(
    _projectId: string,
    movedTaskId: string,
    targetTaskId: string | null,
    mode: 'before' | 'after',
    expectedVersion?: number,
  ): Promise<Task> {
    const body: Record<string, unknown> = {};
    if (targetTaskId) {
      if (mode === 'before') body.beforeTaskId = targetTaskId;
      else body.afterTaskId = targetTaskId;
    }
    if (typeof expectedVersion === 'number') body.expectedVersion = expectedVersion;
    const result = await apiClient.patch<TaskResponse>(`/v1/tasks/${movedTaskId}/order`, body);
    return toDomain(result);
  }

  static async updateTaskPosition(
    movedTaskId: string,
    data: UpdateTaskPositionDto,
  ): Promise<TaskMutationResult> {
    const result = await apiClient.patch<TaskMutationResponse>(
      `/v1/tasks/${movedTaskId}/position`,
      data,
    );
    return toMutationResult(result);
  }
}

export default TaskService;
