import { apiClient } from '../lib/apiClient';
import type {
  Task,
  CreateTaskData,
  TaskFilters,
  TaskType
} from '../types/domain';
import type { UpdateTaskDto } from '@project-workgroup/shared';

const toNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toDomain = (r: any): Task => ({
  id: r.id,
  projectId: r.projectId,
  name: r.name,
  description: r.description,
  startDate: r.startDate ?? '',
  endDate: r.endDate ?? '',
  duration: toNumber(r.duration, 1),
  progress: r.progress ?? 0,
  assigneeId: r.assigneeId,
  parentId: r.parentId,
  dependencies: r.dependencies ?? [],
  tags: r.tags ?? [],
  priority: r.priority ?? 'medium',
  color: r.color ?? '#3B82F6',
  estimatedHours: toNumber(r.estimatedHours, 0),
  actualHours: r.actualHours === null || r.actualHours === undefined ? undefined : toNumber(r.actualHours, 0),
  status: r.status ?? 'not-started',
  type: r.type ?? 'task',
  order: toNumber(r.order, 0),
  open: r.open ?? true,
  createdAt: r.createdAt ?? '',
  updatedAt: r.updatedAt ?? '',
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
    const result = await apiClient.post<any>(`/v1/projects/${data.projectId}/tasks`, {
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      priority: data.priority,
      status: data.status,
      type: data.type,
      color: data.color,
      ...(data.parentId ? { parentId: data.parentId } : {}),
      ...(data.assigneeId ? { assigneeId: data.assigneeId } : {}),
    });
    return result.id;
  }

  static async getTask(id: string): Promise<Task | null> {
    try {
      const result = await apiClient.get<any>(`/v1/tasks/${id}`);
      return toDomain(result);
    } catch (error: any) {
      if (error?.status === 404) return null;
      console.error('Error getting task:', error);
      throw new Error('Error al obtener la tarea');
    }
  }

  static async getProjectTasks(projectId: string, _filters?: TaskFilters): Promise<Task[]> {
    try {
      const result = await apiClient.get<any[]>(`/v1/projects/${projectId}/tasks`);
      return result.map(toDomain);
    } catch (error) {
      console.error('Error getting project tasks:', error);
      return [];
    }
  }

  static async updateTask(id: string, data: UpdateTaskDto): Promise<Task> {
    const result = await apiClient.patch<any>(`/v1/tasks/${id}`, data);
    return toDomain(result);
  }

  static async deleteTask(id: string): Promise<void> {
    await apiClient.delete(`/v1/tasks/${id}`);
  }

  /**
   * Obtener tareas asignadas a un usuario
   * TODO: backend endpoint pending
   */
  static async getUserTasks(_userId: string, _filters?: TaskFilters): Promise<Task[]> {
    return [];
  }

  /**
   * Actualizar el progreso de una tarea
   */
  static async updateTaskProgress(id: string, progress: number): Promise<Task> {
    const result = await apiClient.patch<any>(`/v1/tasks/${id}/progress`, { progress });
    return toDomain(result);
  }

  /**
   * TODO: las dependencias viven en `task_links`, no en la tarea.
   * Estos métodos están desactivados hasta migrar el flujo a TaskLinkService.
   */
  static async addTaskDependency(_taskId: string, _dependencyId: string): Promise<void> {
    throw new Error('addTaskDependency: pendiente de migración a TaskLinkService');
  }

  static async removeTaskDependency(_taskId: string, _dependencyId: string): Promise<void> {
    throw new Error('removeTaskDependency: pendiente de migración a TaskLinkService');
  }

  /**
   * Obtener tareas por tipo
   */
  static async getTasksByType(projectId: string, _type: TaskType): Promise<Task[]> {
    return this.getProjectTasks(projectId);
  }

  static async updateTaskExpandState(taskId: string, isOpen: boolean): Promise<Task> {
    const result = await apiClient.patch<any>(`/v1/tasks/${taskId}`, { open: isOpen });
    return toDomain(result);
  }

  static async updateTaskOrder(
    _projectId: string,
    movedTaskId: string,
    targetTaskId: string | null,
    mode: 'before' | 'after'
  ): Promise<Task> {
    const body: { afterTaskId?: string; beforeTaskId?: string } = {};
    if (targetTaskId) {
      if (mode === 'before') body.beforeTaskId = targetTaskId;
      else body.afterTaskId = targetTaskId;
    }
    const result = await apiClient.patch<any>(`/v1/tasks/${movedTaskId}/order`, body);
    return toDomain(result);
  }
}

export default TaskService;
