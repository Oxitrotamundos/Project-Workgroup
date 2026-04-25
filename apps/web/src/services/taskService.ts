import { apiClient } from '../lib/apiClient';
import type {
  Task,
  CreateTaskData,
  TaskFilters,
  TaskType
} from '../types/domain';
import type { UpdateTaskDto } from '@project-workgroup/shared';

const toDomain = (r: any): Task => ({
  id: r.id,
  projectId: r.projectId,
  name: r.name,
  description: r.description,
  startDate: r.startDate ?? '',
  endDate: r.endDate ?? '',
  duration: r.duration ?? 1,
  progress: r.progress ?? 0,
  assigneeId: r.assigneeId,
  parentId: r.parentId,
  dependencies: r.dependencies ?? [],
  tags: r.tags ?? [],
  priority: r.priority ?? 'medium',
  color: r.color ?? '#3B82F6',
  estimatedHours: r.estimatedHours ?? 0,
  actualHours: r.actualHours,
  status: r.status ?? 'not-started',
  type: r.type ?? 'task',
  order: r.order ?? 0,
  open: r.open ?? true,
  createdAt: r.createdAt ?? '',
  updatedAt: r.updatedAt ?? '',
});

/**
 * Servicio para gestionar tareas a través del API REST
 */
export class TaskService {
  /**
   * Obtener el próximo número de orden para un proyecto
   */
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

  /**
   * Crear una nueva tarea
   */
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

  /**
   * Obtener una tarea por ID
   */
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

  /**
   * Obtener tareas de un proyecto
   */
  static async getProjectTasks(projectId: string, _filters?: TaskFilters): Promise<Task[]> {
    try {
      const result = await apiClient.get<any[]>(`/v1/projects/${projectId}/tasks`);
      return result.map(toDomain);
    } catch (error) {
      console.error('Error getting project tasks:', error);
      return [];
    }
  }

  /**
   * Actualizar una tarea
   */
  static async updateTask(id: string, data: UpdateTaskDto): Promise<void> {
    await apiClient.patch(`/v1/tasks/${id}`, data);
  }

  /**
   * Eliminar una tarea y sus enlaces asociados
   */
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
  static async updateTaskProgress(id: string, progress: number): Promise<void> {
    await apiClient.patch(`/v1/tasks/${id}/progress`, { progress });
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

  /**
   * Update task expand/collapse state
   */
  static async updateTaskExpandState(taskId: string, isOpen: boolean): Promise<void> {
    await apiClient.patch(`/v1/tasks/${taskId}`, { open: isOpen });
  }

  /**
   * Actualizar orden de tareas después de mover una tarea.
   * El backend recibe `afterTaskId` o `beforeTaskId` (UpdateOrderDto);
   * aquí mapeamos el `mode` del Gantt a uno de los dos.
   */
  static async updateTaskOrder(
    _projectId: string,
    movedTaskId: string,
    targetTaskId: string | null,
    mode: 'before' | 'after'
  ): Promise<void> {
    const body: { afterTaskId?: string; beforeTaskId?: string } = {};
    if (targetTaskId) {
      if (mode === 'before') body.beforeTaskId = targetTaskId;
      else body.afterTaskId = targetTaskId;
    }
    await apiClient.patch(`/v1/tasks/${movedTaskId}/order`, body);
  }
}

export default TaskService;
