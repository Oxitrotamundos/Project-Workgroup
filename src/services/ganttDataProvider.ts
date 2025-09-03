/**
 * Adaptador personalizado que implementa la interfaz de RestDataProvider
 * pero se conecta con Firestore en lugar de un servidor REST
 */

import { TaskService } from './taskService';
import type { Task, UpdateTaskData } from '../types/firestore';

export interface GanttDataProviderData {
  tasks: any[];
  links: any[];
}

export class FirestoreGanttDataProvider {
  private projectId: string;
  private listeners: Map<string, Function[]> = new Map();
  private _nextHandler: any = null;
  private idMapping: Map<number, string> = new Map(); // Mapeo de ID numérico a firestoreId

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  /**
   * Obtener el ID de Firestore a partir del ID numérico del Gantt
   */
  getFirestoreIdFromGanttId(ganttId: number): string | undefined {
    return this.idMapping.get(ganttId);
  }

  /**
   * Configurar el siguiente handler en la cadena de eventos
   */
  setNext(handler: any): void {
    this._nextHandler = handler;
  }

  /**
   * Ejecutar una acción en la cadena de eventos
   */
  async exec(action: string, data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Ejecutando acción:', { action, data });
    
    try {
      // Procesar la acción localmente
      const result = await this.send(action, data);
      
      // Si hay un siguiente handler en la cadena, ejecutarlo también
      if (this._nextHandler && this._nextHandler.exec) {
        await this._nextHandler.exec(action, data);
      }
      
      return result;
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error ejecutando acción:', error);
      throw error;
    }
  }

  /**
   * Cargar datos del proyecto desde Firestore
   */
  async getData(): Promise<GanttDataProviderData> {
    try {
      console.log('FirestoreGanttDataProvider: Cargando datos del proyecto:', this.projectId);
      
      const tasks = await TaskService.getProjectTasks(this.projectId);
      
      // Limpiar el mapeo anterior
      this.idMapping.clear();
      
      // Crear mapeo de firestoreId a ID numérico para resolver parentId
      const firestoreToNumericMap = new Map<string, number>();
      
      // Primer paso: generar IDs numéricos y crear mapeo
      tasks.forEach((task: Task, index: number) => {
        const numericId = task.id.split('').reduce((acc: number, char: string) => {
          return acc + char.charCodeAt(0);
        }, 0) + index;
        
        // Guardar ambos mapeos
        this.idMapping.set(numericId, task.id);
        firestoreToNumericMap.set(task.id, numericId);
      });
      
      // Segundo paso: convertir tareas de Firestore al formato del Gantt
      const ganttTasks = tasks.map((task: Task) => {
        const startDate = task.startDate instanceof Date ? task.startDate : task.startDate.toDate();
        const endDate = task.endDate instanceof Date ? task.endDate : task.endDate.toDate();
        
        // Calcular duración en días
        const durationInMs = endDate.getTime() - startDate.getTime();
        const durationInDays = Math.ceil(durationInMs / (1000 * 60 * 60 * 24));
        
        // Obtener el ID numérico de esta tarea
        const numericId = firestoreToNumericMap.get(task.id)!;
        
        // Resolver el parentId si existe
        let parentNumericId: number | undefined = undefined;
        if (task.parentId) {
          parentNumericId = firestoreToNumericMap.get(task.parentId);
          console.log('FirestoreGanttDataProvider: Resolviendo jerarquía - Tarea:', task.name, 'Parent Firestore ID:', task.parentId, '-> Parent Numeric ID:', parentNumericId);
        }
        
        const ganttTask: any = {
          id: numericId,
          text: task.name,
          start: startDate,
          end: endDate,
          duration: durationInDays,
          progress: task.progress,
          type: 'task',
          lazy: false,
          details: task.description || '',
          // Mantener referencia al ID original de Firestore
          firestoreId: task.id
        };
        
        // Establecer la relación padre-hijo si existe
        if (parentNumericId !== undefined) {
          ganttTask.parent = parentNumericId;
        }
        
        return ganttTask;
      });
      
      console.log('FirestoreGanttDataProvider: Datos cargados:', {
        tasksCount: ganttTasks.length,
        tasks: ganttTasks
      });
      
      return {
        tasks: ganttTasks,
        links: [] // Por ahora no manejamos links
      };
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error cargando datos:', error);
      throw error;
    }
  }

  /**
   * Procesar acciones del Gantt y sincronizar con Firestore
   */
  async send(action: string, data: any, id?: string): Promise<any> {
    console.log('FirestoreGanttDataProvider: Procesando acción:', { action, data, id });
    
    try {
      switch (action) {
        case 'add-task':
          return await this.handleAddTask(data);
        
        case 'update-task':
          return await this.handleUpdateTask(data);
        
        case 'delete-task':
          return await this.handleDeleteTask(data);
        
        case 'move-task':
          return await this.handleMoveTask(data);
        
        case 'drag-task':
          return await this.handleDragTask(data);
        
        // Acciones de UI que no requieren sincronización con Firestore
        case 'expand-scale':
        case 'show-editor':
        case 'hide-editor':
        case 'select-task':
        case 'unselect-task':
        case 'expand-task':
        case 'collapse-task':
          console.log('FirestoreGanttDataProvider: Acción de UI ignorada:', action);
          return { success: true, message: 'Acción de UI procesada localmente' };
        
        default:
          console.warn('FirestoreGanttDataProvider: Acción no soportada:', action);
          return { success: false, error: 'Acción no soportada' };
      }
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error procesando acción:', error);
      throw error;
    }
  }

  private async handleAddTask(data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Redirigiendo creación de tarea al TaskManager');
    
    // Importar dinámicamente para evitar dependencias circulares
    const { taskManager } = await import('./taskManager');
    
    // Determinar si es una tarea principal o subtarea
    const parentFirestoreId = data.mode === 'child' && data.target 
      ? this.getFirestoreIdFromGanttId(data.target)
      : undefined;
    
    console.log('FirestoreGanttDataProvider: Parent Firestore ID:', parentFirestoreId);
    
    try {
      let taskId: string;
      
      if (parentFirestoreId) {
        // Crear subtarea usando TaskManager
        taskId = await taskManager.createSubtask(parentFirestoreId, {
          projectId: this.projectId,
          name: data.text || 'Nueva Subtarea',
          description: data.details || '',
          priority: 'medium',
          estimatedHours: (data.duration || 1) * 8
        });
      } else {
        // Crear tarea principal usando TaskManager
        taskId = await taskManager.createTask({
          projectId: this.projectId,
          name: data.text || 'Nueva Tarea',
          description: data.details || '',
          startDate: data.start,
          endDate: data.end,
          duration: data.duration,
          priority: 'medium',
          estimatedHours: (data.duration || 7) * 8
        });
      }
      
      console.log('FirestoreGanttDataProvider: Tarea creada con ID:', taskId);
      
      // No emitir evento aquí ya que TaskManager ya emitió el evento 'task-created'
      // Esto evita duplicar actualizaciones
      console.log('FirestoreGanttDataProvider: Tarea creada por TaskManager, no emitiendo evento duplicado');
      
      return { success: true, id: taskId };
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error creando tarea:', error);
      throw error;
    }
  }

  private async handleUpdateTask(data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Actualizando tarea:', data);
    
    // Intentar obtener el firestoreId de los datos o del mapeo
    let firestoreId = data.firestoreId;
    
    if (!firestoreId && data.id) {
      // Si no hay firestoreId pero hay un ID numérico, buscar en el mapeo
      firestoreId = this.idMapping.get(data.id);
      console.log('FirestoreGanttDataProvider: Buscando firestoreId para ID numérico:', data.id, '-> encontrado:', firestoreId);
    }
    
    // Verificar que tenemos un ID de Firestore válido
    if (!firestoreId) {
      console.error('FirestoreGanttDataProvider: No se encontró firestoreId en los datos ni en el mapeo:', data);
      console.error('FirestoreGanttDataProvider: Mapeo actual:', Array.from(this.idMapping.entries()));
      throw new Error('ID de Firestore requerido para actualización');
    }
    
    // Validar que el firestoreId es un string
    if (typeof firestoreId !== 'string') {
      console.error('FirestoreGanttDataProvider: firestoreId no es un string:', typeof firestoreId, firestoreId);
      throw new Error('ID de Firestore debe ser un string');
    }
    
    // Determinar la fuente de los datos de la tarea
    let taskData = data;
    
    // Si los datos vienen en el formato { id, task, diff } (típico de update-task después de arrastre)
    if (data.task && typeof data.task === 'object') {
      console.log('FirestoreGanttDataProvider: Datos en formato task object:', data.task);
      console.log('FirestoreGanttDataProvider: Propiedades de data.task:', Object.keys(data.task));
      console.log('FirestoreGanttDataProvider: Contenido completo de data.task:', JSON.stringify(data.task, null, 2));
      taskData = data.task;
    }
    
    // Agregar logs para debug
    console.log('FirestoreGanttDataProvider: taskData después de asignación:', taskData);
    console.log('FirestoreGanttDataProvider: Propiedades de taskData:', Object.keys(taskData));
    
    // Si los datos de la tarea están vacíos o incompletos, obtener desde la API del Gantt
    const hasValidData = taskData.text || taskData.start || taskData.end || taskData.name || taskData.startDate || taskData.endDate;
    console.log('FirestoreGanttDataProvider: hasValidData:', hasValidData);
    
    if (!hasValidData && data.id && this._nextHandler && this._nextHandler.getTask) {
      console.log('FirestoreGanttDataProvider: Datos vacíos detectados, obteniendo datos actualizados de la API del Gantt');
      const updatedTask = this._nextHandler.getTask(data.id);
      console.log('FirestoreGanttDataProvider: Tarea obtenida de la API:', updatedTask);
      
      if (updatedTask) {
        taskData = {
          text: updatedTask.text,
          details: updatedTask.details,
          start: updatedTask.start,
          end: updatedTask.end,
          duration: updatedTask.duration,
          progress: updatedTask.progress
        };
        console.log('FirestoreGanttDataProvider: Datos actualizados obtenidos:', taskData);
      }
    }
    
    const updateData: UpdateTaskData = {
      name: taskData.text || taskData.name,
      description: taskData.details || taskData.description,
      startDate: taskData.start || taskData.startDate,
      endDate: taskData.end || taskData.endDate,
      duration: taskData.duration,
      progress: taskData.progress
    };
    
    // Filtrar campos undefined
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof UpdateTaskData] === undefined) {
        delete updateData[key as keyof UpdateTaskData];
      }
    });
    
    console.log('FirestoreGanttDataProvider: Actualizando tarea con ID:', firestoreId, 'Datos:', updateData);
    
    // Solo actualizar si hay datos válidos para actualizar
    if (Object.keys(updateData).length > 0) {
      await TaskService.updateTask(firestoreId, updateData);
      console.log('FirestoreGanttDataProvider: Tarea actualizada exitosamente sin recarga');
    } else {
      console.log('FirestoreGanttDataProvider: No hay datos para actualizar, omitiendo llamada a Firestore');
    }
    
    return { success: true };
  }

  private async handleDeleteTask(data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Eliminando tarea:', data);
    
    // Intentar obtener el firestoreId de los datos o del mapeo
    let firestoreId = data.firestoreId;
    
    if (!firestoreId && data.id) {
      // Si no hay firestoreId pero hay un ID numérico, buscar en el mapeo
      firestoreId = this.idMapping.get(data.id);
      console.log('FirestoreGanttDataProvider: Buscando firestoreId para eliminación, ID numérico:', data.id, '-> encontrado:', firestoreId);
    }
    
    // Verificar que tenemos un ID de Firestore válido
    if (!firestoreId) {
      console.error('FirestoreGanttDataProvider: No se encontró firestoreId en los datos ni en el mapeo:', data);
      console.error('FirestoreGanttDataProvider: Mapeo actual:', Array.from(this.idMapping.entries()));
      throw new Error('ID de Firestore requerido para eliminación');
    }
    
    // Validar que el firestoreId es un string
    if (typeof firestoreId !== 'string') {
      console.error('FirestoreGanttDataProvider: firestoreId no es un string:', typeof firestoreId, firestoreId);
      throw new Error('ID de Firestore debe ser un string');
    }
    
    await TaskService.deleteTask(firestoreId);
    
    // Remover del mapeo después de eliminar exitosamente
    if (data.id) {
      this.idMapping.delete(data.id);
      console.log('FirestoreGanttDataProvider: Tarea eliminada del mapeo, ID:', data.id);
    }
    
    // Emitir evento de eliminación - esto sí requiere recarga
    this.emit('data-updated', { action: 'delete-task', taskId: data.firestoreId });
    
    return { success: true };
  }

  private async handleMoveTask(data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Moviendo tarea:', data);
    
    // Verificar si el arrastre está en progreso
    if (data.inProgress) {
      console.log('FirestoreGanttDataProvider: Movimiento en progreso, no guardando orden');
      return;
    }
    
    try {
      // Obtener el firestoreId de la tarea que se está moviendo
      let movedTaskFirestoreId = data.firestoreId;
      if (!movedTaskFirestoreId && data.id) {
        movedTaskFirestoreId = this.idMapping.get(data.id);
      }
      
      // Obtener el firestoreId de la tarea objetivo
      let targetTaskFirestoreId = null;
      if (data.target) {
        targetTaskFirestoreId = this.idMapping.get(data.target);
        console.log('FirestoreGanttDataProvider: Target task ID:', data.target, '-> Firestore ID:', targetTaskFirestoreId);
      }
      
      if (!movedTaskFirestoreId) {
        console.error('FirestoreGanttDataProvider: No se pudo obtener el ID de Firestore de la tarea movida');
        return;
      }
      
      console.log('FirestoreGanttDataProvider: Actualizando orden - Moved:', movedTaskFirestoreId, 'Target:', targetTaskFirestoreId, 'Mode:', data.mode);
      
      // Importar TaskService dinámicamente para evitar circular imports
      const { TaskService } = await import('./taskService');
      
      // Actualizar el orden en Firestore
      await TaskService.updateTaskOrder(
        this.projectId,
        movedTaskFirestoreId,
        targetTaskFirestoreId || null,
        data.mode || 'after'
      );
      
      console.log('FirestoreGanttDataProvider: Orden actualizado exitosamente');
      
      // Emitir evento para que el componente recargue los datos
      this.emit('data-updated', { action: 'move-task' });
      
      return { success: true };
      
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error al actualizar orden de tarea:', error);
      throw error;
    }
  }

  private async handleDragTask(data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Arrastrando tarea:', data);
    
    // Verificar si el arrastre está en progreso
    // Si inProgress es true, solo permitir la actualización visual sin guardar en DB
    if (data.inProgress) {
      console.log('FirestoreGanttDataProvider: Arrastre en progreso, no guardando en DB');
      // Retornar sin hacer nada para permitir la actualización visual
      return;
    }
    
    console.log('FirestoreGanttDataProvider: Arrastre completado, obteniendo datos actualizados de la tarea');
    
    // El arrastre se ha completado, obtener los datos actualizados de la tarea desde la API del gantt
    if (this._nextHandler && this._nextHandler.getTask) {
      const updatedTask = this._nextHandler.getTask(data.id);
      console.log('FirestoreGanttDataProvider: Datos actualizados de la tarea:', updatedTask);
      
      if (updatedTask) {
        const taskData = {
          id: data.id,
          start: updatedTask.start,
          end: updatedTask.end,
          duration: updatedTask.duration,
          text: updatedTask.text,
          progress: updatedTask.progress
        };
        
        // Usar el método de actualización existente para persistir los cambios
        return await this.handleUpdateTask(taskData);
      }
    }
    
    console.warn('FirestoreGanttDataProvider: No se pudo obtener los datos actualizados de la tarea');
    return;
  }

  /**
   * Sistema de eventos simple
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error en callback de evento:', error);
      }
    });
  }

  /**
   * Limpiar listeners
   */
  destroy(): void {
    this.listeners.clear();
  }
}