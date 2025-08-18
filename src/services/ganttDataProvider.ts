/**
 * Adaptador personalizado que implementa la interfaz de RestDataProvider
 * pero se conecta con Firestore en lugar de un servidor REST
 */

import { TaskService } from './taskservice';
import type { Task, CreateTaskData, UpdateTaskData } from '../types/firestore';

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
      
      // Convertir tareas de Firestore al formato del Gantt
      const ganttTasks = tasks.map((task: Task, index: number) => {
        const startDate = task.startDate instanceof Date ? task.startDate : task.startDate.toDate();
        const endDate = task.endDate instanceof Date ? task.endDate : task.endDate.toDate();
        
        // Calcular duración en días
        const durationInMs = endDate.getTime() - startDate.getTime();
        const durationInDays = Math.ceil(durationInMs / (1000 * 60 * 60 * 24));
        
        // Generar ID numérico único
        const numericId = task.id.split('').reduce((acc: number, char: string) => {
          return acc + char.charCodeAt(0);
        }, 0) + index;
        
        // Guardar el mapeo de ID numérico a firestoreId
        this.idMapping.set(numericId, task.id);
        
        return {
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
    console.log('FirestoreGanttDataProvider: Agregando tarea:', data);
    
    const taskData: CreateTaskData = {
      projectId: this.projectId,
      name: data.text || 'Nueva Tarea',
      description: data.details || '',
      startDate: data.start || new Date(),
      endDate: data.end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días por defecto
      duration: data.duration || 7,
      progress: data.progress || 0,
      assigneeId: '',
      dependencies: [],
      tags: [],
      priority: 'medium',
      color: '#3B82F6',
      estimatedHours: data.duration * 8 || 56, // 8 horas por día
      status: 'not-started'
    };
    
    const taskId = await TaskService.createTask(taskData);
    
    // Emitir evento de actualización
    this.emit('data-updated', { action: 'add-task', taskId });
    
    return { success: true, id: taskId };
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
    
    const updateData: UpdateTaskData = {
      name: data.text,
      description: data.details,
      startDate: data.start,
      endDate: data.end,
      duration: data.duration,
      progress: data.progress
    };
    
    // Filtrar campos undefined
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof UpdateTaskData] === undefined) {
        delete updateData[key as keyof UpdateTaskData];
      }
    });
    
    console.log('FirestoreGanttDataProvider: Actualizando tarea con ID:', firestoreId, 'Datos:', updateData);
    
    await TaskService.updateTask(firestoreId, updateData);
    
    // Emitir evento de actualización
    this.emit('data-updated', { action: 'update-task', taskId: firestoreId });
    
    return { success: true };
  }

  private async handleDeleteTask(data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Eliminando tarea:', data);
    
    // Verificar que tenemos un ID de Firestore válido
    if (!data.firestoreId) {
      console.error('FirestoreGanttDataProvider: No se encontró firestoreId en los datos:', data);
      throw new Error('ID de Firestore requerido para eliminación');
    }
    
    // Validar que el firestoreId es un string
    if (typeof data.firestoreId !== 'string') {
      console.error('FirestoreGanttDataProvider: firestoreId no es un string:', typeof data.firestoreId, data.firestoreId);
      throw new Error('ID de Firestore debe ser un string');
    }
    
    await TaskService.deleteTask(data.firestoreId);
    
    // Emitir evento de eliminación
    this.emit('data-updated', { action: 'delete-task', taskId: data.firestoreId });
    
    return { success: true };
  }

  private async handleMoveTask(data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Moviendo tarea:', data);
    
    // Implementar lógica de movimiento si es necesario
    // Por ahora, tratarlo como una actualización
    return await this.handleUpdateTask(data);
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