import { TaskService } from './taskService';
import { TaskLinkService } from './taskLinkService';
import { TASK_TYPE_COLORS } from '../types/domain';
import type { CreateTaskData, Task, CreateTaskLinkData, TaskType } from '../types/domain';

export interface TaskCreationOptions {
  projectId: string;
  name: string;
  description?: string;
  parentId?: string;
  assigneeId?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'not-started' | 'in-progress' | 'completed' | 'blocked';
  type?: 'task' | 'summary' | 'milestone';
  estimatedHours?: number;
  startDate?: Date;
  endDate?: Date;
  duration?: number;
  skipEvent?: boolean;
}

export interface TaskManagerEventData {
  action: 'task-created' | 'task-updated' | 'task-deleted' | 'link-created' | 'link-deleted';
  taskId?: string;
  task?: Task;
  projectId: string;
  linkId?: string;
  sourceTaskId?: string;
  targetTaskId?: string;
  timestamp: Date;
}

export type TaskManagerEventHandler = (data: TaskManagerEventData) => void;

export class TaskManager {
  private static instance: TaskManager | null = null;
  private eventHandlers: Set<TaskManagerEventHandler> = new Set();

  private constructor() {}

  static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager();
    }
    return TaskManager.instance;
  }

  on(handler: TaskManagerEventHandler): void {
    this.eventHandlers.add(handler);
  }

  off(handler: TaskManagerEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  private emit(data: TaskManagerEventData): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('Error en handler de TaskManager:', error);
      }
    });
  }

  async createTask(options: TaskCreationOptions): Promise<string> {
    console.log('TaskManager: Creando tarea con opciones:', options);

    if (!options.projectId) {
      throw new Error('ID del proyecto es obligatorio');
    }

    if (!options.name || options.name.trim().length === 0) {
      throw new Error('El nombre de la tarea es obligatorio');
    }

    const now = new Date();
    const defaultEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 días por defecto

    const startDateObj = options.startDate || now;
    const endDateObj = options.endDate || defaultEndDate;

    const taskData: CreateTaskData = {
      projectId: options.projectId,
      name: options.name.trim(),
      description: options.description || '',
      startDate: startDateObj.toISOString(),
      endDate: endDateObj.toISOString(),
      duration: 0,
      progress: 0,
      assigneeId: options.assigneeId || '',
      parentId: options.parentId || '',
      dependencies: [],
      tags: [],
      priority: options.priority || 'medium',
      type: options.type || 'task',
      color: this.getColorForTaskType(options.type || 'task'),
      estimatedHours: options.estimatedHours ?? 0,
      status: options.status ?? 'not-started'
    };

    try {
      console.log('TaskManager: Datos de tarea validados:', taskData);

      const taskId = await TaskService.createTask(taskData);
      
      console.log('TaskManager: Tarea creada exitosamente con ID:', taskId);

      const createdTask = await TaskService.getTask(taskId);

      if (!options.skipEvent) {
        console.log('TaskManager: Emitiendo evento task-created para:', taskId);
        this.emit({
          action: 'task-created',
          taskId,
          task: createdTask || undefined,
          projectId: options.projectId,
          timestamp: new Date()
        });
      } else {
        console.log('TaskManager: Omitiendo evento de creación por skipEvent=true para tarea:', taskId);
      }

      return taskId;
    } catch (error) {
      console.error('TaskManager: Error creando tarea:', error);
      throw error;
    }
  }

  async createSubtask(parentTaskId: string, options: Omit<TaskCreationOptions, 'parentId'>): Promise<string> {
    console.log('TaskManager: Creando subtarea para padre:', parentTaskId);

    const parentTask = await TaskService.getTask(parentTaskId);
    if (!parentTask) {
      throw new Error('Tarea padre no encontrada');
    }

    return this.createTask({
      ...options,
      parentId: parentTaskId,
      projectId: parentTask.projectId
    });
  }

  async createTaskFromGantt(ganttTaskData: any, projectId: string, parentId?: string): Promise<string> {
    console.log('TaskManager: Creando tarea desde Gantt:', ganttTaskData);

    const options: TaskCreationOptions = {
      projectId,
      name: ganttTaskData.text || 'Nueva Tarea',
      description: ganttTaskData.description || '',
      startDate: ganttTaskData.start || new Date(),
      endDate: ganttTaskData.end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      parentId: parentId || ganttTaskData.parent,
      assigneeId: ganttTaskData.assignee || '',
      priority: ganttTaskData.priority || 'medium',
      type: ganttTaskData.type || 'task',
    };

    return this.createTask(options);
  }

  async updateTask(taskId: string, updates: Partial<TaskCreationOptions>): Promise<void> {
    console.log('TaskManager: Actualizando tarea:', taskId, updates);

    try {
      const updateData: any = {};
      
      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.startDate !== undefined) updateData.startDate = updates.startDate;
      if (updates.endDate !== undefined) updateData.endDate = updates.endDate;
      if (updates.duration !== undefined) updateData.duration = updates.duration;
      if (updates.assigneeId !== undefined) updateData.assigneeId = updates.assigneeId;
      if (updates.parentId !== undefined) updateData.parentId = updates.parentId;
      if (updates.priority !== undefined) {
        updateData.priority = updates.priority;
      }
      if (updates.type !== undefined) {
        updateData.type = updates.type;
        updateData.color = this.getColorForTaskType(updates.type);
      }
      if (updates.estimatedHours !== undefined) updateData.estimatedHours = updates.estimatedHours;

      await TaskService.updateTask(taskId, updateData);

      const updatedTask = await TaskService.getTask(taskId);

      this.emit({
        action: 'task-updated',
        taskId,
        task: updatedTask || undefined,
        projectId: updatedTask?.projectId || '',
        timestamp: new Date()
      });

      console.log('TaskManager: Tarea actualizada exitosamente');
    } catch (error) {
      console.error('TaskManager: Error actualizando tarea:', error);
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    console.log('TaskManager: Eliminando tarea:', taskId);

    try {
      const task = await TaskService.getTask(taskId);
      const projectId = task?.projectId || '';

      await TaskService.deleteTask(taskId);

      this.emit({
        action: 'task-deleted',
        taskId,
        projectId,
        timestamp: new Date()
      });

      console.log('TaskManager: Tarea eliminada exitosamente');
    } catch (error) {
      console.error('TaskManager: Error eliminando tarea:', error);
      throw error;
    }
  }


  private getColorForTaskType(type: TaskType): string {
    return TASK_TYPE_COLORS[type];
  }


  //MÉTODOS DE ENLACES - OPCIONAL

  async createTaskLink(data: CreateTaskLinkData): Promise<string> {
    try {
      console.log('TaskManager: Creando enlace de tarea:', data);

      const sourceTask = await TaskService.getTask(data.sourceTaskId);
      const targetTask = await TaskService.getTask(data.targetTaskId);

      if (!sourceTask || !targetTask) {
        throw new Error('Una o ambas tareas no existen');
      }

      if (sourceTask.projectId !== targetTask.projectId || sourceTask.projectId !== data.projectId) {
        throw new Error('Las tareas deben pertenecer al mismo proyecto');
      }

      const linkId = await TaskLinkService.createLink(data);

      this.emit({
        action: 'link-created',
        projectId: data.projectId,
        linkId,
        sourceTaskId: data.sourceTaskId,
        targetTaskId: data.targetTaskId,
        timestamp: new Date()
      });

      return linkId;
    } catch (error) {
      console.error('TaskManager: Error creando enlace:', error);
      throw error;
    }
  }

  async deleteTaskLink(linkId: string): Promise<void> {
    try {
      console.log('TaskManager: Eliminando enlace de tarea:', linkId);

      const link = await TaskLinkService.getLink(linkId);
      if (!link) {
        throw new Error('Enlace no encontrado');
      }

      await TaskLinkService.deleteLink(linkId);

      this.emit({
        action: 'link-deleted',
        projectId: link.projectId,
        linkId,
        sourceTaskId: link.sourceTaskId,
        targetTaskId: link.targetTaskId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('TaskManager: Error eliminando enlace:', error);
      throw error;
    }
  }

  async validateLinkCreation(sourceTaskId: string, targetTaskId: string, projectId: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      return await TaskLinkService.validateLinkCreation(sourceTaskId, targetTaskId, projectId);
    } catch (error) {
      console.error('TaskManager: Error validando enlace:', error);
      return { valid: false, error: 'Error al validar la creación del enlace' };
    }
  }

}

export const taskManager = TaskManager.getInstance();
export default taskManager;