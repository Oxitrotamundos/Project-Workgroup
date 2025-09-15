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
  private _ganttApi: any = null; // Referencia directa al API del Gantt
  private idMapping: Map<number, string> = new Map(); // Mapeo de ID numérico a firestoreId
  private tempIdMapping: Map<string, string> = new Map(); // Mapeo de ID temporal a firestoreId
  private taskCache: Map<string, Task> = new Map(); // Cache de datos completos de Firestore

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
   * Obtener datos completos de tarea desde cache
   */
  getFullTaskData(firestoreId: string): Task | undefined {
    return this.taskCache.get(firestoreId);
  }

  /**
   * Obtener datos completos usando ID numérico del Gantt
   */
  getFullTaskDataByGanttId(ganttId: number): Task | undefined {
    const firestoreId = this.getFirestoreIdFromGanttId(ganttId);
    return firestoreId ? this.getFullTaskData(firestoreId) : undefined;
  }

  /**
   * Restaurar estado de expansión usando API de wx-react-gantt
   */
  async restoreExpansionStates(): Promise<void> {
    if (!this._ganttApi) {
      console.warn('FirestoreGanttDataProvider: API del Gantt no disponible para restaurar estados');
      return;
    }

    try {
      // Verificar que wx-react-gantt esté completamente cargado
      const state = this._ganttApi.getState();
      const tasksInGantt = state?._tasks?.length || 0;

      if (tasksInGantt === 0) {
        console.warn('wx-react-gantt no tiene tareas cargadas aún, abortando restauración');
        return;
      }

      console.log('FirestoreGanttDataProvider: Iniciando restauración de estados de expansión');
      let restoredCount = 0;

      // Obtener todas las tareas con sus estados de expansión
      for (const [firestoreId, taskData] of this.taskCache.entries()) {
        const ganttId = this.getGanttIdFromFirestoreId(firestoreId);

        if (!ganttId) continue;

        // Verificar si la tarea tiene hijos usando el API del Gantt
        const ganttTask = this._ganttApi.getTask(ganttId);
        const hasChildren = ganttTask && ganttTask.data && ganttTask.data.length > 0;

        if (hasChildren) {
          // Solo expandir si explícitamente está marcado como open: true en Firestore
          const shouldBeOpen = taskData.open === true;

          if (shouldBeOpen) {
            try {
              // TRUCO: Forzar colapso primero para sincronizar estado visual
              this._ganttApi.exec('close-task', { id: ganttId, _fromRestore: true });

              // Luego expandir para lograr el estado deseado
              setTimeout(() => {
                try {
                  this._ganttApi.exec('open-task', { id: ganttId, _fromRestore: true });
                } catch (error) {
                  console.error(`Error expandiendo tarea ${ganttId}:`, error);
                }
              }, 100); // Pequeño delay para que wx-react-gantt procese el colapso

              restoredCount++;
            } catch (error) {
              console.error(`Error en sincronización de tarea ${ganttId}:`, error);
            }
          }
          // Si open: false o undefined, dejar colapsado (estado por defecto del Gantt)
        }
      }

      console.log(`FirestoreGanttDataProvider: Restauración completada. ${restoredCount} tareas procesadas`);
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error restaurando estados de expansión:', error);
    }
  }

  /**
   * Obtener ID numérico del Gantt a partir del ID de Firestore (mapeo inverso)
   */
  private getGanttIdFromFirestoreId(firestoreId: string): number | undefined {
    for (const [ganttId, storedFirestoreId] of this.idMapping.entries()) {
      if (storedFirestoreId === firestoreId) {
        return ganttId;
      }
    }
    return undefined;
  }

  /**
   * Configurar referencia directa al API del Gantt (para consultas sin crear loops)
   */
  setGanttApi(api: any): void {
    this._ganttApi = api;
  }

  /**
   * Ejecutar una acción en la cadena de eventos
   */
  async exec(action: string, data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Ejecutando acción:', { action, data });
    
    try {
      // Procesar la acción localmente
      const result = await this.send(action, data);
      
      // Note: No llamamos a _nextHandler.exec() para evitar loops infinitos
      // Solo usamos _ganttApi para consultas directas sin generar eventos
      
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
      
      // Limpiar los mapeos anteriores
      this.idMapping.clear();
      this.taskCache.clear(); // Limpiar cache anterior
      
      // Poblar cache con datos completos
      tasks.forEach((task: Task) => {
        this.taskCache.set(task.id, task);
      });
      
      // Note: No limpiar tempIdMapping aquí para preservar mapeos de tareas recién creadas
      
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
        // Validar datos obligatorios
        if (!task.id || !task.name) {
          console.warn('FirestoreGanttDataProvider: Tarea con datos incompletos ignorada:', task);
          return null;
        }

        // Validar y convertir fechas con fallbacks seguros
        let startDate: Date, endDate: Date;
        try {
          // Asegurar que siempre sean objetos Date válidos
          if (task.startDate instanceof Date) {
            startDate = task.startDate;
          } else if (task.startDate?.toDate) {
            startDate = task.startDate.toDate();
          } else if (typeof task.startDate === 'string') {
            startDate = new Date(task.startDate);
          } else {
            startDate = new Date();
          }
          
          if (task.endDate instanceof Date) {
            endDate = task.endDate;
          } else if (task.endDate?.toDate) {
            endDate = task.endDate.toDate();
          } else if (typeof task.endDate === 'string') {
            endDate = new Date(task.endDate);
          } else {
            endDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
          }
          
          // Validar que las fechas sean válidas
          if (isNaN(startDate.getTime())) {
            console.warn('FirestoreGanttDataProvider: startDate inválida, usando fallback');
            startDate = new Date();
          }
          if (isNaN(endDate.getTime())) {
            console.warn('FirestoreGanttDataProvider: endDate inválida, usando fallback');
            endDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
          }
          
        } catch (error) {
          console.warn('FirestoreGanttDataProvider: Error convirtiendo fechas, usando fallbacks:', error);
          startDate = new Date();
          endDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }
        
        // Calcular duración en días
        const durationInMs = endDate.getTime() - startDate.getTime();
        const durationInDays = Math.ceil(durationInMs / (1000 * 60 * 60 * 24));
        
        // Obtener el ID numérico de esta tarea
        const numericId = firestoreToNumericMap.get(task.id)!;
        
        // Resolver el parentId si existe
        let parentNumericId: number | undefined = undefined;
        if (task.parentId) {
          parentNumericId = firestoreToNumericMap.get(task.parentId);
        }
        
        // CRÍTICO: Asegurar que las fechas sean objetos Date reales, no strings
        const ensuredStartDate = startDate instanceof Date ? startDate : new Date(startDate);
        const ensuredEndDate = endDate instanceof Date ? endDate : new Date(endDate);
        
        // Formato para wx-react-gantt con validación de propiedad open
        const ganttTask: any = {
          id: numericId,
          text: task.name,
          start: ensuredStartDate,
          end: ensuredEndDate,
          duration: durationInDays,
          progress: task.progress || 0,
          type: task.type || 'task',
          parent: parentNumericId ?? 0,
          data: []
        };

        // Determinar si esta tarea puede tener hijos (necesita propiedad 'open')
        // Verificar si hay otras tareas que tienen esta como parent
        const hasChildren = tasks.some(otherTask => otherTask.parentId === task.id);

        if (hasChildren) {
          // Solo tareas que realmente tienen hijos necesitan la propiedad 'open'
          ganttTask.open = task.open !== false; // Por defecto true para expandir
        }
        
        // Guardar firestoreId por separado para mapeo interno
        // (no enviado a wx-react-gantt)
        ganttTask._internalFirestoreId = task.id;
        
        // Validación de compatibilidad con wx-react-gantt
        this.validateGanttTaskCompatibility(ganttTask);
        
        return ganttTask;
      }).filter(task => task !== null); // Filtrar tareas nulas
      
      console.log('FirestoreGanttDataProvider: Datos cargados:', {
        totalTasks: tasks.length,
        validTasks: ganttTasks.length,
        tasks: ganttTasks
      });
      
      // LOG: Resumen de datos procesados
      console.log('FirestoreGanttDataProvider: Datos procesados:', {
        totalTasks: tasks.length,
        validTasks: ganttTasks.length,
        tasksWithCache: this.taskCache.size
      });
      
      return {
        tasks: ganttTasks,
        links: []
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
        
        case 'render-data':
          // Acción de UI pura - wx-react-gantt solicita re-renderizado
          console.log('FirestoreGanttDataProvider: render-data procesado');
          return { success: true };
        
        // Acciones de UI que no requieren sincronización con Firestore
        case 'expand-scale':
        case 'show-editor':
        case 'hide-editor':
        case 'select-task':
        case 'unselect-task':
        case 'expand-task':
        case 'collapse-task':
        case 'open-task':
        case 'close-task':
          // Verificar si el evento viene de nuestra restauración
          if (data._fromRestore) {
            console.log('FirestoreGanttDataProvider: Evento de restauración procesado:', action, data.id);
            return { success: true, message: 'Evento de restauración procesado' };
          } else {
            console.log('FirestoreGanttDataProvider: Evento expand/collapse IGNORADO (usando detección DOM):', action);
            // IMPORTANTE: No sincronizar estos eventos ya que son inconsistentes
            // Usamos detección DOM en su lugar
            return { success: true, message: 'Evento ignorado - usando detección DOM' };
          }
        
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
        console.log('FirestoreGanttDataProvider: Creando subtarea con skipEvent=true');
        taskId = await taskManager.createSubtask(parentFirestoreId, {
          projectId: this.projectId,
          name: data.text || 'Nueva Subtarea',
          description: data.details || '',
          priority: 'medium',
          type: data.type || 'task',
          estimatedHours: (data.duration || 1) * 8,
          skipEvent: true // Evitar evento que causa recarga completa
        });
        console.log('FirestoreGanttDataProvider: Subtarea creada con skipEvent, ID:', taskId);
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
          type: data.type || 'task',
          estimatedHours: (data.duration || 7) * 8,
          skipEvent: true // Evitar evento que causa recarga desde el Gantt
        });
      }
      
      console.log('FirestoreGanttDataProvider: Tarea creada con ID:', taskId);
      
      // Si hay un ID temporal en los datos, crear mapeo para futuras actualizaciones
      if (data.id && typeof data.id === 'string' && data.id.startsWith('temp://')) {
        console.log('FirestoreGanttDataProvider: Creando mapeo temporal:', data.id, '->', taskId);
        this.tempIdMapping.set(data.id, taskId);
      }
      
      // No emitir evento de recarga cuando se crean tareas desde el Gantt
      // El Gantt ya maneja estas actualizaciones localmente y evitamos colapsos
      console.log('FirestoreGanttDataProvider: Tarea creada desde Gantt, evitando recarga para preservar estado UI');
      
      return { success: true, id: taskId };
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error creando tarea:', error);
      throw error;
    }
  }

  private async handleUpdateTask(data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Actualizando tarea:', data);
    
    // NOTE: La detección por eventSource no funciona, procesamos jerarquía en move-task directamente
    
    // Intentar obtener el firestoreId de los datos o del mapeo
    let firestoreId = data.firestoreId;
    
    if (!firestoreId && data.id) {
      // Primero verificar si es un ID temporal
      if (typeof data.id === 'string' && data.id.startsWith('temp://')) {
        firestoreId = this.tempIdMapping.get(data.id);
        console.log('FirestoreGanttDataProvider: Buscando firestoreId para ID temporal:', data.id, '-> encontrado:', firestoreId);
      } else {
        // Si no hay firestoreId pero hay un ID numérico, buscar en el mapeo
        firestoreId = this.idMapping.get(data.id);
        console.log('FirestoreGanttDataProvider: Buscando firestoreId para ID numérico:', data.id, '-> encontrado:', firestoreId);
      }
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
    
    if (!hasValidData && data.id && this._ganttApi && this._ganttApi.getTask) {
      console.log('FirestoreGanttDataProvider: Datos vacíos detectados, obteniendo datos actualizados de la API del Gantt');
      const updatedTask = this._ganttApi.getTask(data.id);
      console.log('FirestoreGanttDataProvider: Tarea obtenida de la API:', updatedTask);
      
      if (updatedTask) {
        taskData = {
          text: updatedTask.text,
          details: updatedTask.details,
          start: updatedTask.start,
          end: updatedTask.end,
          duration: updatedTask.duration,
          progress: updatedTask.progress,
          type: updatedTask.type
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
      progress: taskData.progress,
      type: taskData.type // Incluir el tipo de tarea
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
    
    // No emitir evento de recarga para eliminaciones desde el Gantt
    // El Gantt ya maneja la eliminación localmente
    console.log('FirestoreGanttDataProvider: Tarea eliminada, evitando recarga para preservar estado UI');
    
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
        // Primero verificar si es un ID temporal
        if (typeof data.id === 'string' && data.id.startsWith('temp://')) {
          movedTaskFirestoreId = this.tempIdMapping.get(data.id);
          console.log('FirestoreGanttDataProvider: Buscando firestoreId para ID temporal en move:', data.id, '-> encontrado:', movedTaskFirestoreId);
        } else {
          // Si no es temporal, buscar en el mapeo numérico
          movedTaskFirestoreId = this.idMapping.get(data.id);
          console.log('FirestoreGanttDataProvider: Buscando firestoreId para ID numérico en move:', data.id, '-> encontrado:', movedTaskFirestoreId);
        }
      }
      
      // Obtener el firestoreId de la tarea objetivo
      let targetTaskFirestoreId: string | null = null;
      if (data.target) {
        targetTaskFirestoreId = this.idMapping.get(data.target) || null;
        console.log('FirestoreGanttDataProvider: Target task ID:', data.target, '-> Firestore ID:', targetTaskFirestoreId);
      }
      
      if (!movedTaskFirestoreId) {
        console.error('FirestoreGanttDataProvider: No se pudo obtener el ID de Firestore de la tarea movida');
        return;
      }
      
      console.log('FirestoreGanttDataProvider: Actualizando orden - Moved:', movedTaskFirestoreId, 'Target:', targetTaskFirestoreId, 'Mode:', data.mode);
      
      // Importar TaskService dinámicamente para evitar circular imports
      const { TaskService } = await import('./taskService');
      
      // Procesar cambios de jerarquía después del movimiento
      console.log('FirestoreGanttDataProvider: Movimiento completado, procesando jerarquía');
      const hierarchyResult = await this.processTaskHierarchyUpdate({ id: data.id });
      
      // Solo continuar si la jerarquía se actualizó correctamente
      if (!hierarchyResult.success) {
        console.error('FirestoreGanttDataProvider: Error en jerarquía, abortando actualización de orden');
        return hierarchyResult;
      }
      
      // Actualizar el orden en Firestore
      await TaskService.updateTaskOrder(
        this.projectId,
        movedTaskFirestoreId,
        targetTaskFirestoreId || null,
        data.mode || 'after'
      );
      
      console.log('FirestoreGanttDataProvider: Orden actualizado exitosamente');
      
      // NOTE: No emitir evento de recarga ya que el Gantt maneja la UI localmente
      console.log('FirestoreGanttDataProvider: Movimiento procesado exitosamente sin recarga');
      
      return { success: true };
      
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error al actualizar orden de tarea:', error);
      throw error;
    }
  }

  private async processTaskHierarchyUpdate(data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Procesando actualización de jerarquía:', data);
    
    // Obtener el ID de la tarea que fue movida
    let taskId = data.id;
    if (data.task && data.task.id) {
      taskId = data.task.id;
    }
    
    if (!taskId) {
      console.warn('FirestoreGanttDataProvider: No se pudo determinar el ID de la tarea movida');
      return { success: false, error: 'ID de tarea no encontrado' };
    }
    
    // Obtener el firestoreId de la tarea movida
    let movedTaskFirestoreId: string | undefined;
    if (typeof taskId === 'string' && taskId.startsWith('temp://')) {
      movedTaskFirestoreId = this.tempIdMapping.get(taskId);
      console.log('FirestoreGanttDataProvider: Buscando firestoreId para ID temporal en jerarquía:', taskId, '-> encontrado:', movedTaskFirestoreId);
    } else {
      movedTaskFirestoreId = this.idMapping.get(taskId);
      console.log('FirestoreGanttDataProvider: Buscando firestoreId para ID numérico en jerarquía:', taskId, '-> encontrado:', movedTaskFirestoreId);
    }
    
    if (!movedTaskFirestoreId) {
      console.error('FirestoreGanttDataProvider: No se pudo obtener el ID de Firestore de la tarea movida para jerarquía');
      return { success: false, error: 'Firestore ID no encontrado' };
    }
    
    // Obtener los datos actualizados de la tarea movida desde el Gantt
    let newParentId: string | null = null;
    if (this._ganttApi && this._ganttApi.getTask && taskId) {
      const movedTask = this._ganttApi.getTask(taskId);
      console.log('FirestoreGanttDataProvider: Tarea movida después del movimiento:', movedTask);
      
      if (movedTask) {
        if (movedTask.parent) {
          // La tarea tiene un parent, obtener su firestoreId
          const parentFirestoreId = this.idMapping.get(movedTask.parent);
          if (parentFirestoreId) {
            newParentId = parentFirestoreId;
            console.log('FirestoreGanttDataProvider: Nueva jerarquía detectada, parentId:', newParentId);
          } else {
            console.warn('FirestoreGanttDataProvider: Parent ID no encontrado en mapeo:', movedTask.parent);
            return { success: false, error: 'Parent ID no encontrado en mapeo' };
          }
        } else {
          // La tarea no tiene parent, está en el nivel raíz
          newParentId = null;
          console.log('FirestoreGanttDataProvider: Tarea movida a nivel raíz');
        }
      } else {
        console.warn('FirestoreGanttDataProvider: No se pudo obtener datos actualizados de la tarea movida');
        return { success: false, error: 'No se pudo obtener datos de la tarea' };
      }
    }
    
    // Actualizar parentId si es necesario
    if (newParentId !== undefined) {
      console.log('FirestoreGanttDataProvider: Actualizando parentId de', movedTaskFirestoreId, 'a', newParentId);
      try {
        const { TaskService } = await import('./taskService');
        
        // TaskService maneja correctamente null (usa deleteField()) y string (parentId válido)  
        await TaskService.updateTask(movedTaskFirestoreId, { parentId: newParentId });
        console.log('FirestoreGanttDataProvider: ParentId actualizado exitosamente');
      } catch (error) {
        console.error('FirestoreGanttDataProvider: Error actualizando parentId:', error);
        // En caso de error, la jerarquía en el Gantt puede estar desincronizada con Firestore
        // Se necesitaría una recarga completa para sincronizar
        this.emit('data-updated', { action: 'sync-error', error });
        return { success: false, error: 'Error actualizando jerarquía' };
      }
    }
    
    return { success: true };
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
    if (this._ganttApi && this._ganttApi.getTask) {
      const updatedTask = this._ganttApi.getTask(data.id);
      console.log('FirestoreGanttDataProvider: Datos actualizados de la tarea:', updatedTask);
      
      if (updatedTask) {
        const taskData = {
          id: data.id,
          start: updatedTask.start,
          end: updatedTask.end,
          duration: updatedTask.duration,
          text: updatedTask.text,
          progress: updatedTask.progress,
          type: updatedTask.type
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
   * Handle expand/collapse state changes with enhanced validation and caching
   */
  async handleExpandCollapseState(data: any): Promise<void> {
    const { id, isOpen } = data;
 
    // Get Firestore ID from mapping
    const firestoreId = this.getFirestoreIdFromGanttId(id);
    if (!firestoreId) {
      console.warn('FirestoreGanttDataProvider: No se encontró Firestore ID para evento expand/collapse:', id);
      return;
    }

    try {
      // Update local cache first for immediate consistency
      const cachedTask = this.taskCache.get(firestoreId);
      if (cachedTask) {
        cachedTask.open = isOpen;
        console.log(`FirestoreGanttDataProvider: Cache actualizado para tarea ${firestoreId}: open=${isOpen}`);
      }
 
      // Import TaskService dynamically to avoid circular imports
      const { TaskService } = await import('./taskService');
 
      // Update in Firestore with retry logic
      const maxRetries = 3;
      let attempt = 0;
      
      while (attempt < maxRetries) {
        try {
          await TaskService.updateTaskExpandState(firestoreId, isOpen);
          console.log(`Estado de expansión actualizado en Firestore para tarea ${firestoreId}: ${isOpen ? 'expandida' : 'colapsada'}`);
          break;
        } catch (error) {
          attempt++;
          console.warn(`Intento ${attempt} falló para actualizar estado de tarea ${firestoreId}:`, error);
          
          if (attempt === maxRetries) {
            throw new Error(`Failed to update expand state after ${maxRetries} attempts`);
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 200 * attempt));
        }
      }
      
    } catch (error) {
      console.error('✗ Error actualizando estado de expansión:', error);
      
      // Revert local cache on error
      const cachedTask = this.taskCache.get(firestoreId);
      if (cachedTask) {
        cachedTask.open = !isOpen; // Revert to previous state
        console.log(`FirestoreGanttDataProvider: Cache revertido para tarea ${firestoreId} debido a error`);
      }
      
      throw error;
    }
  }

  /**
   * Validar compatibilidad de tarea con wx-react-gantt
   */
  private validateGanttTaskCompatibility(task: any): void {
    const requiredProps = ['id', 'text', 'start', 'end', 'duration', 'progress', 'type', 'parent', 'data'];
    const allowedCustomProps = ['_internalFirestoreId']; // Props internas permitidas
    
    // Verificar propiedades requeridas
    for (const prop of requiredProps) {
      if (!(prop in task)) {
        console.warn(`FirestoreGanttDataProvider: Propiedad requerida faltante: ${prop}`, task);
      }
    }
    
    // Verificar tipos de fecha
    if (!(task.start instanceof Date)) {
      console.warn('FirestoreGanttDataProvider: start no es Date object:', typeof task.start);
    }
    if (!(task.end instanceof Date)) {
      console.warn('FirestoreGanttDataProvider: end no es Date object:', typeof task.end);
    }
    
    // Verificar propiedades extra que pueden causar crashes
    const taskProps = Object.keys(task);
    const extraProps = taskProps.filter(prop => 
      !requiredProps.includes(prop) && !allowedCustomProps.includes(prop)
    );
    
    if (extraProps.length > 0) {
      console.warn('FirestoreGanttDataProvider: Propiedades extra detectadas (pueden causar crashes):', extraProps);
    }
  }

  /**
   * Limpiar listeners y mapeos
   */
  destroy(): void {
    this.listeners.clear();
    this.idMapping.clear();
    this.tempIdMapping.clear();
    this.taskCache.clear();
  }
}