import { TaskService } from './taskService';
import type { CreateTaskData, Task } from '../types/firestore';

export interface TaskCreationOptions {
  projectId: string;
  name: string;
  description?: string;
  parentId?: string;
  assigneeId?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  type?: 'task' | 'summary' | 'milestone';
  estimatedHours?: number;
  startDate?: Date;
  endDate?: Date;
  duration?: number;
  skipEvent?: boolean; // Flag para evitar emitir eventos
}

export interface TaskManagerEventData {
  action: 'task-created' | 'task-updated' | 'task-deleted';
  taskId: string;
  task?: Task;
  projectId: string;
}

export type TaskManagerEventHandler = (data: TaskManagerEventData) => void;

/**
 * TaskManager centraliza todas las operaciones de tareas
 * Proporciona un punto único de entrada para crear, actualizar y eliminar tareas
 * Maneja la sincronización entre el sistema de Gantt y Firestore
 */
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

  /**
   * Suscribirse a eventos del TaskManager
   */
  on(handler: TaskManagerEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Desuscribirse de eventos del TaskManager
   */
  off(handler: TaskManagerEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Emitir evento a todos los suscriptores
   */
  private emit(data: TaskManagerEventData): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('Error en handler de TaskManager:', error);
      }
    });
  }

  /**
   * Crear una nueva tarea con validación y sincronización completa
   */
  async createTask(options: TaskCreationOptions): Promise<string> {
    console.log('TaskManager: Creando tarea con opciones:', options);

    // Validar datos obligatorios
    if (!options.projectId) {
      throw new Error('ID del proyecto es obligatorio');
    }

    if (!options.name || options.name.trim().length === 0) {
      throw new Error('El nombre de la tarea es obligatorio');
    }

    // Establecer valores por defecto
    const now = new Date();
    const defaultEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 días por defecto
    
    const taskData: CreateTaskData = {
      projectId: options.projectId,
      name: options.name.trim(),
      description: options.description || '',
      startDate: options.startDate || now,
      endDate: options.endDate || defaultEndDate,
      duration: options.duration || this.calculateDuration(options.startDate || now, options.endDate || defaultEndDate),
      progress: 0,
      assigneeId: options.assigneeId || '',
      parentId: options.parentId || '',
      dependencies: [],
      tags: [],
      priority: options.priority || 'medium',
      type: options.type || 'task',
      color: this.getColorForTaskType(options.type || 'task'),
      estimatedHours: options.estimatedHours || (options.duration || 7) * 8, // 8 horas por día por defecto
      status: 'not-started'
    };

    try {
      console.log('TaskManager: Datos de tarea validados:', taskData);

      // Crear tarea en Firestore
      const taskId = await TaskService.createTask(taskData);
      
      console.log('TaskManager: Tarea creada exitosamente con ID:', taskId);

      // Obtener la tarea creada para el evento
      const createdTask = await TaskService.getTask(taskId);

      // Emitir evento de creación solo si no se especifica skipEvent
      if (!options.skipEvent) {
        console.log('TaskManager: Emitiendo evento task-created para:', taskId);
        this.emit({
          action: 'task-created',
          taskId,
          task: createdTask || undefined,
          projectId: options.projectId
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

  /**
   * Crear una subtarea (tarea con padre)
   */
  async createSubtask(parentTaskId: string, options: Omit<TaskCreationOptions, 'parentId'>): Promise<string> {
    console.log('TaskManager: Creando subtarea para padre:', parentTaskId);

    // Obtener información de la tarea padre
    const parentTask = await TaskService.getTask(parentTaskId);
    if (!parentTask) {
      throw new Error('Tarea padre no encontrada');
    }

    // Crear subtarea con referencia al padre, preservando el flag skipEvent
    return this.createTask({
      ...options,
      parentId: parentTaskId,
      projectId: parentTask.projectId // Heredar el proyecto del padre
    });
  }

  /**
   * Crear tarea desde el sistema de Gantt
   * Esta función maneja las tareas creadas directamente desde el chart de Gantt
   */
  async createTaskFromGantt(ganttTaskData: any, projectId: string, parentId?: string): Promise<string> {
    console.log('TaskManager: Creando tarea desde Gantt:', ganttTaskData);

    const options: TaskCreationOptions = {
      projectId,
      name: ganttTaskData.text || 'Nueva Tarea',
      description: ganttTaskData.description || '',
      startDate: ganttTaskData.start || new Date(),
      endDate: ganttTaskData.end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      duration: ganttTaskData.duration || 7,
      parentId: parentId || ganttTaskData.parent,
      assigneeId: ganttTaskData.assignee || '',
      priority: ganttTaskData.priority || 'medium',
      type: ganttTaskData.type || 'task',
      estimatedHours: ganttTaskData.duration * 8 || 56
    };

    return this.createTask(options);
  }

  /**
   * Actualizar una tarea existente
   */
  async updateTask(taskId: string, updates: Partial<TaskCreationOptions>): Promise<void> {
    console.log('TaskManager: Actualizando tarea:', taskId, updates);

    try {
      // Convertir opciones a formato de actualización
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

      // Obtener tarea actualizada
      const updatedTask = await TaskService.getTask(taskId);

      // Emitir evento de actualización
      this.emit({
        action: 'task-updated',
        taskId,
        task: updatedTask || undefined,
        projectId: updatedTask?.projectId || ''
      });

      console.log('TaskManager: Tarea actualizada exitosamente');
    } catch (error) {
      console.error('TaskManager: Error actualizando tarea:', error);
      throw error;
    }
  }

  /**
   * Eliminar una tarea
   */
  async deleteTask(taskId: string): Promise<void> {
    console.log('TaskManager: Eliminando tarea:', taskId);

    try {
      // Obtener tarea antes de eliminar para el evento
      const task = await TaskService.getTask(taskId);
      const projectId = task?.projectId || '';

      await TaskService.deleteTask(taskId);

      // Emitir evento de eliminación
      this.emit({
        action: 'task-deleted',
        taskId,
        projectId
      });

      console.log('TaskManager: Tarea eliminada exitosamente');
    } catch (error) {
      console.error('TaskManager: Error eliminando tarea:', error);
      throw error;
    }
  }


  /**
   * Obtener color basado en tipo de tarea
   */
  private getColorForTaskType(type: 'task' | 'summary' | 'milestone'): string {
    const colors = {
      task: '#3B82F6',     // Azul para tareas normales
      summary: '#8B5CF6',  // Púrpura para tareas resumen
      milestone: '#F59E0B' // Amarillo/Naranja para milestones
    };
    return colors[type];
  }

  /**
   * Calcular duración en días entre dos fechas
   */
  private calculateDuration(startDate: Date, endDate: Date): number {
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays); // Mínimo 1 día
  }
}

// Export singleton instance
export const taskManager = TaskManager.getInstance();
export default taskManager;