import { apiClient } from '../lib/apiClient';
import type {
  Task,
  CreateTaskData,
  UpdateTaskData,
  TaskFilters,
  TaskType
} from '../types/domain';

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
      duration: data.duration,
      progress: data.progress,
      assigneeId: data.assigneeId,
      parentId: data.parentId,
      dependencies: data.dependencies,
      tags: data.tags,
      priority: data.priority,
      color: data.color,
      estimatedHours: data.estimatedHours,
      actualHours: data.actualHours,
      status: data.status,
      type: data.type,
      order: data.order,
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
  static async updateTask(id: string, data: UpdateTaskData): Promise<void> {
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
   * Agregar dependencia a una tarea
   */
  static async addTaskDependency(taskId: string, dependencyId: string): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task) throw new Error('Tarea no encontrada');
    if (!task.dependencies.includes(dependencyId)) {
      await this.updateTask(taskId, { dependencies: [...task.dependencies, dependencyId] });
    }
  }

  /**
   * Remover dependencia de una tarea
   */
  static async removeTaskDependency(taskId: string, dependencyId: string): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task) throw new Error('Tarea no encontrada');
    await this.updateTask(taskId, { dependencies: task.dependencies.filter(id => id !== dependencyId) });
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
   * Actualizar orden de tareas después de mover una tarea
   */
  static async updateTaskOrder(
    projectId: string,
    movedTaskId: string,
    targetTaskId: string | null,
    mode: 'before' | 'after'
  ): Promise<void> {
    await apiClient.patch(`/v1/tasks/${movedTaskId}/order`, {
      projectId,
      targetTaskId,
      mode,
    });
  }
}

export default TaskService;
