import { TaskService } from './taskService';
import { TaskLinkService } from './taskLinkService';
import type { Task, TaskLink, GanttLinkData, GanttLinkEvent, GanttLinkResponse, UpdateTaskLinkData } from '../types/domain';
import type { UpdateTaskDto } from '@project-workgroup/shared';

const toIsoDate = (value: Date | string | undefined | null): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    return value.length >= 10 ? value.slice(0, 10) : value;
  }
  return undefined;
};

export interface GanttDataProviderData {
  tasks: any[];
  links: any[];
}

export class FirestoreGanttDataProvider {
  private projectId: string;
  private listeners: Map<string, Function[]> = new Map();
  private _ganttApi: any = null;
  private _next: any = null;
  private tempIdMapping: Map<string, string> = new Map(); // temp://... -> real ID
  private taskCache: Map<string, Task> = new Map();
  private linkCache: Map<string, TaskLink> = new Map();

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  getFirestoreIdFromGanttId(ganttId: number): string | undefined {
    return String(ganttId);
  }

  getFullTaskData(taskId: string): Task | undefined {
    return this.taskCache.get(taskId);
  }

  getFullTaskDataByGanttId(ganttId: number): Task | undefined {
    return this.getFullTaskData(String(ganttId));
  }

  getLinkFirestoreIdFromGanttId(ganttId: number | string): string | undefined {
    if (typeof ganttId === 'string' && ganttId.startsWith('temp://')) {
      return this.linkCache.get(ganttId)?.id;
    }
    return String(ganttId);
  }

  getFullLinkData(linkId: string): TaskLink | undefined {
    return this.linkCache.get(linkId);
  }

  getFullLinkDataByGanttId(ganttId: number | string): TaskLink | undefined {
    const linkId = this.getLinkFirestoreIdFromGanttId(ganttId);
    return linkId ? this.getFullLinkData(linkId) : undefined;
  }

  async restoreExpansionStates(): Promise<void> {
    if (!this._ganttApi) {
      console.warn('FirestoreGanttDataProvider: API del Gantt no disponible para restaurar estados');
      return;
    }

    try {
      const state = this._ganttApi.getState();
      const tasksInGantt = state?._tasks?.length || 0;

      if (tasksInGantt === 0) {
        console.warn('wx-react-gantt no tiene tareas cargadas aún, abortando restauración');
        return;
      }

      console.log('FirestoreGanttDataProvider: Iniciando restauración de estados de expansión');
      let restoredCount = 0;

      for (const [taskId, taskData] of this.taskCache.entries()) {
        const ganttId = Number(taskId);
        if (isNaN(ganttId)) continue;

        const ganttTask = this._ganttApi.getTask(ganttId);
        const hasChildren = ganttTask && ganttTask.data && ganttTask.data.length > 0;

        if (hasChildren) {
          const shouldBeOpen = taskData.open === true;

          if (shouldBeOpen) {
            try {
              this._ganttApi.exec('close-task', { id: ganttId, _fromRestore: true });
              setTimeout(() => {
                try {
                  this._ganttApi.exec('open-task', { id: ganttId, _fromRestore: true });
                } catch (error) {
                  console.error(`Error expandiendo tarea ${ganttId}:`, error);
                }
              }, 100);
              restoredCount++;
            } catch (error) {
              console.error(`Error en sincronización de tarea ${ganttId}:`, error);
            }
          }
        }
      }

      console.log(`FirestoreGanttDataProvider: Restauración completada. ${restoredCount} tareas procesadas`);
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error restaurando estados de expansión:', error);
    }
  }

  setGanttApi(api: any): void {
    this._ganttApi = api;
  }

  setNext(next: any): void {
    this._next = next;
  }

  async exec(action: string, data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Ejecutando acción:', { action, data });
    try {
      const result = await this.send(action, data);
      return result;
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error ejecutando acción:', error);
      throw error;
    }
  }

  async getData(): Promise<GanttDataProviderData> {
    try {
      console.log('FirestoreGanttDataProvider: Cargando datos del proyecto:', this.projectId);

      const [tasks, links] = await Promise.all([
        TaskService.getProjectTasks(this.projectId),
        TaskLinkService.getProjectLinks(this.projectId)
      ]);

      this.taskCache.clear();
      this.linkCache.clear();

      tasks.forEach((task: Task) => {
        this.taskCache.set(task.id, task);
      });

      links.forEach((link: TaskLink) => {
        this.linkCache.set(link.id, link);
      });

      const ganttTasks = tasks.map((task: Task) => {
        if (!task.id || !task.name) {
          console.warn('FirestoreGanttDataProvider: Tarea con datos incompletos ignorada:', task);
          return null;
        }

        let startDate: Date, endDate: Date;
        try {
          startDate = task.startDate ? new Date(task.startDate) : new Date();
          endDate = task.endDate ? new Date(task.endDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);

          if (isNaN(startDate.getTime())) startDate = new Date();
          if (isNaN(endDate.getTime())) endDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        } catch (error) {
          console.warn('FirestoreGanttDataProvider: Error convirtiendo fechas:', error);
          startDate = new Date();
          endDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }

        const durationInMs = endDate.getTime() - startDate.getTime();
        const durationInDays = Math.ceil(durationInMs / (1000 * 60 * 60 * 24));

        const numericId = Number(task.id);
        const parentNumericId = task.parentId ? Number(task.parentId) : undefined;

        const hasChildren = tasks.some(otherTask => otherTask.parentId === task.id);

        const ganttTask: any = {
          id: numericId,
          text: task.name,
          start: startDate,
          end: endDate,
          duration: durationInDays,
          progress: task.progress || 0,
          type: task.type || 'task',
          parent: parentNumericId ?? 0,
          data: []
        };

        if (hasChildren) {
          ganttTask.open = task.open !== false;
        }

        ganttTask._internalFirestoreId = task.id;

        this.validateGanttTaskCompatibility(ganttTask);

        return ganttTask;
      }).filter(task => task !== null);

      const ganttLinks: GanttLinkData[] = [];

      links.forEach((link: TaskLink) => {
        const sourceNumericId = Number(link.sourceTaskId);
        const targetNumericId = Number(link.targetTaskId);

        if (isNaN(sourceNumericId) || isNaN(targetNumericId)) {
          console.warn('FirestoreGanttDataProvider: Enlace ignorado, IDs inválidos:', link);
          return;
        }

        const linkNumericId = Number(link.id);

        const ganttLink: GanttLinkData = {
          id: linkNumericId,
          source: sourceNumericId,
          target: targetNumericId,
          type: link.type
        };

        ganttLinks.push(ganttLink);
      });

      console.log('FirestoreGanttDataProvider: Datos cargados:', {
        totalTasks: tasks.length,
        validTasks: ganttTasks.length,
        totalLinks: links.length,
        validLinks: ganttLinks.length,
      });

      return { tasks: ganttTasks, links: ganttLinks };
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error cargando datos:', error);
      throw error;
    }
  }

  async send(action: string, data: any, _id?: string): Promise<any> {
    console.log('FirestoreGanttDataProvider: Procesando acción:', { action, data });

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
          console.log('FirestoreGanttDataProvider: render-data procesado');
          return { success: true };
        case 'add-link':
          return await this.handleAddLink(data);
        case 'update-link':
          return await this.handleUpdateLink(data);
        case 'delete-link':
          return await this.handleDeleteLink(data);
        case 'expand-scale':
        case 'show-editor':
        case 'hide-editor':
        case 'select-task':
        case 'unselect-task':
        case 'expand-task':
        case 'collapse-task':
        case 'open-task':
        case 'close-task':
          if (data._fromRestore) {
            return { success: true, message: 'Evento de restauración procesado' };
          }
          return this._next ? this._next.send(action, data) : { success: true };
        default:
          return this._next ? this._next.send(action, data) : { success: false, error: 'Acción no soportada' };
      }
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error procesando acción:', error);
      throw error;
    }
  }

  private async handleAddTask(data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Redirigiendo creación de tarea al TaskManager');

    const { taskManager } = await import('./taskManager');

    const parentId = data.mode === 'child' && data.target
      ? this.getFirestoreIdFromGanttId(data.target)
      : undefined;

    try {
      let taskId: string;

      if (parentId) {
        taskId = await taskManager.createSubtask(parentId, {
          projectId: this.projectId,
          name: data.text || 'Nueva Subtarea',
          description: data.details || '',
          priority: 'medium',
          type: data.type || 'task',
          estimatedHours: (data.duration || 1) * 8,
          skipEvent: true
        });
      } else {
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
          skipEvent: true
        });
      }

      if (data.id && typeof data.id === 'string' && data.id.startsWith('temp://')) {
        this.tempIdMapping.set(data.id, taskId);
      }

      return { success: true, id: taskId };
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error creando tarea:', error);
      throw error;
    }
  }

  private async handleUpdateTask(data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Actualizando tarea:', data);

    let taskId: string | undefined = data.firestoreId;

    if (!taskId && data.id) {
      if (typeof data.id === 'string' && data.id.startsWith('temp://')) {
        taskId = this.tempIdMapping.get(data.id);
      } else {
        taskId = String(data.id);
      }
    }

    if (!taskId) {
      console.error('FirestoreGanttDataProvider: No se encontró ID de tarea para actualización:', data);
      throw new Error('ID de tarea requerido para actualización');
    }

    let taskData = data;

    if (data.task && typeof data.task === 'object') {
      taskData = data.task;
    }

    const hasValidData = taskData.text || taskData.start || taskData.end || taskData.name || taskData.startDate || taskData.endDate;

    if (!hasValidData && data.id && this._ganttApi && this._ganttApi.getTask) {
      const updatedTask = this._ganttApi.getTask(data.id);
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
      }
    }

    const updateData: UpdateTaskDto = {};

    const nextName = taskData.text ?? taskData.name;
    if (nextName !== undefined) updateData.name = nextName;

    const nextDescription = taskData.details ?? taskData.description;
    if (nextDescription !== undefined) updateData.description = nextDescription;

    const nextStart = toIsoDate(taskData.start ?? taskData.startDate);
    if (nextStart !== undefined) updateData.startDate = nextStart;

    const nextEnd = toIsoDate(taskData.end ?? taskData.endDate);
    if (nextEnd !== undefined) updateData.endDate = nextEnd;

    if (taskData.type !== undefined) updateData.type = taskData.type;

    const calls: Promise<unknown>[] = [];

    if (Object.keys(updateData).length > 0) {
      calls.push(TaskService.updateTask(taskId, updateData));
    }

    if (taskData.progress !== undefined && Number.isFinite(taskData.progress)) {
      const cached = this.taskCache.get(taskId);
      const nextProgress = Math.max(0, Math.min(100, Math.round(taskData.progress)));
      if (!cached || cached.progress !== nextProgress) {
        calls.push(TaskService.updateTaskProgress(taskId, nextProgress));
      }
    }

    if (calls.length > 0) {
      await Promise.all(calls);
    }

    return { success: true };
  }

  private async handleDeleteTask(data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Eliminando tarea:', data);

    let taskId: string | undefined = data.firestoreId;

    if (!taskId && data.id) {
      taskId = String(data.id);
    }

    if (!taskId) {
      console.error('FirestoreGanttDataProvider: No se encontró ID de tarea para eliminación:', data);
      throw new Error('ID de tarea requerido para eliminación');
    }

    await TaskService.deleteTask(taskId);

    return { success: true };
  }

  private async handleMoveTask(data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Moviendo tarea:', data);

    if (data.inProgress) {
      return;
    }

    try {
      let movedTaskId: string | undefined = data.firestoreId;
      if (!movedTaskId && data.id) {
        if (typeof data.id === 'string' && data.id.startsWith('temp://')) {
          movedTaskId = this.tempIdMapping.get(data.id);
        } else {
          movedTaskId = String(data.id);
        }
      }

      let targetTaskId: string | null = null;
      if (data.target) {
        targetTaskId = String(data.target);
      }

      if (!movedTaskId) {
        console.error('FirestoreGanttDataProvider: No se pudo obtener el ID de la tarea movida');
        return;
      }

      const hierarchyResult = await this.processTaskHierarchyUpdate({ id: data.id });

      if (!hierarchyResult.success) {
        console.error('FirestoreGanttDataProvider: Error en jerarquía');
        return hierarchyResult;
      }

      const { TaskService: TS } = await import('./taskService');
      await TS.updateTaskOrder(this.projectId, movedTaskId, targetTaskId || null, data.mode || 'after');

      return { success: true };
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error al actualizar orden de tarea:', error);
      throw error;
    }
  }

  private async processTaskHierarchyUpdate(data: any): Promise<any> {
    let taskId = data.id;
    if (data.task && data.task.id) {
      taskId = data.task.id;
    }

    if (!taskId) {
      return { success: false, error: 'ID de tarea no encontrado' };
    }

    let movedTaskId: string;
    if (typeof taskId === 'string' && taskId.startsWith('temp://')) {
      const resolved = this.tempIdMapping.get(taskId);
      if (!resolved) return { success: false, error: 'Firestore ID no encontrado' };
      movedTaskId = resolved;
    } else {
      movedTaskId = String(taskId);
    }

    let newParentId: string | null = null;
    if (this._ganttApi && this._ganttApi.getTask && taskId) {
      const movedTask = this._ganttApi.getTask(taskId);

      if (movedTask) {
        if (movedTask.parent) {
          newParentId = String(movedTask.parent);
        } else {
          newParentId = null;
        }
      } else {
        return { success: false, error: 'No se pudo obtener datos de la tarea' };
      }
    }

    if (newParentId !== undefined) {
      try {
        const { TaskService: TS } = await import('./taskService');
        await TS.updateTask(movedTaskId, { parentId: newParentId });
      } catch (error) {
        console.error('FirestoreGanttDataProvider: Error actualizando parentId:', error);
        this.emit('data-updated', { action: 'sync-error', error });
        return { success: false, error: 'Error actualizando jerarquía' };
      }
    }

    return { success: true };
  }

  private async handleDragTask(data: any): Promise<any> {
    console.log('FirestoreGanttDataProvider: Arrastrando tarea:', data);

    if (data.inProgress) {
      return;
    }

    if (this._ganttApi && this._ganttApi.getTask) {
      const updatedTask = this._ganttApi.getTask(data.id);

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
        return await this.handleUpdateTask(taskData);
      }
    }

    return;
  }

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

  async handleExpandCollapseState(data: any): Promise<void> {
    const { id, isOpen } = data;

    const taskId = String(id);

    try {
      const cachedTask = this.taskCache.get(taskId);
      if (cachedTask) {
        cachedTask.open = isOpen;
      }

      const { TaskService: TS } = await import('./taskService');

      const maxRetries = 3;
      let attempt = 0;

      while (attempt < maxRetries) {
        try {
          await TS.updateTaskExpandState(taskId, isOpen);
          break;
        } catch (error) {
          attempt++;
          if (attempt === maxRetries) throw new Error(`Failed after ${maxRetries} attempts`);
          await new Promise(resolve => setTimeout(resolve, 200 * attempt));
        }
      }
    } catch (error) {
      console.error('Error actualizando estado de expansión:', error);

      const cachedTask = this.taskCache.get(taskId);
      if (cachedTask) {
        cachedTask.open = !isOpen;
      }

      throw error;
    }
  }

  private validateGanttTaskCompatibility(task: any): void {
    const requiredProps = ['id', 'text', 'start', 'end', 'duration', 'progress', 'type', 'parent', 'data'];
    const allowedCustomProps = ['_internalFirestoreId'];

    for (const prop of requiredProps) {
      if (!(prop in task)) {
        console.warn(`FirestoreGanttDataProvider: Propiedad requerida faltante: ${prop}`, task);
      }
    }

    if (!(task.start instanceof Date)) {
      console.warn('FirestoreGanttDataProvider: start no es Date object:', typeof task.start);
    }
    if (!(task.end instanceof Date)) {
      console.warn('FirestoreGanttDataProvider: end no es Date object:', typeof task.end);
    }

    const taskProps = Object.keys(task);
    const extraProps = taskProps.filter(prop =>
      !requiredProps.includes(prop) && !allowedCustomProps.includes(prop)
    );

    if (extraProps.length > 0) {
      console.warn('FirestoreGanttDataProvider: Propiedades extra detectadas:', extraProps);
    }
  }

  private async handleAddLink(data: any): Promise<GanttLinkResponse> {
    console.log('FirestoreGanttDataProvider: Creando enlace:', data);

    try {
      let sourceId: number, targetId: number, linkType: any, tempId: any;

      if (data.link) {
        sourceId = data.link.source;
        targetId = data.link.target;
        linkType = data.link.type;
        tempId = data.id;
      } else {
        sourceId = data.source;
        targetId = data.target;
        linkType = data.type;
        tempId = data.id;
      }

      const sourceTaskId = String(sourceId);
      const targetTaskId = String(targetId);

      const validation = await TaskLinkService.validateLinkCreation(sourceTaskId, targetTaskId, this.projectId);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const linkId = await TaskLinkService.createLink({
        projectId: this.projectId,
        sourceTaskId,
        targetTaskId,
        type: linkType
      });

      const newLink = await TaskLinkService.getLink(linkId);
      if (newLink) {
        this.linkCache.set(linkId, newLink);
        if (tempId) {
          this.linkCache.set(String(tempId), newLink);
        }
      }

      return { success: true, id: linkId };
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error creando enlace:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al crear enlace'
      };
    }
  }

  private async handleUpdateLink(data: GanttLinkEvent): Promise<GanttLinkResponse> {
    console.log('FirestoreGanttDataProvider: Actualizando enlace:', data);

    try {
      const linkId = this.getLinkFirestoreIdFromGanttId(data.id!);

      if (!linkId) {
        return { success: false, error: 'No se encontró el ID para el enlace' };
      }

      const linkData = (data as any).link || data;
      const updateData: UpdateTaskLinkData = {};
      if (linkData.type !== undefined) {
        updateData.type = linkData.type;
      }

      if (Object.keys(updateData).length === 0) {
        return { success: true, id: linkId };
      }

      await TaskLinkService.updateLink(linkId, updateData);

      const updatedLink = await TaskLinkService.getLink(linkId);
      if (updatedLink) {
        this.linkCache.set(linkId, updatedLink);
      }

      return { success: true, id: linkId };
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error actualizando enlace:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al actualizar enlace'
      };
    }
  }

  private async handleDeleteLink(data: GanttLinkEvent): Promise<GanttLinkResponse> {
    console.log('FirestoreGanttDataProvider: Eliminando enlace:', data);

    try {
      let ganttId: string | number;

      if (typeof data.id === 'string') {
        ganttId = data.id.startsWith('temp://') ? data.id : parseInt(data.id, 10);
      } else if (data.id !== undefined) {
        ganttId = data.id;
      } else {
        return { success: false, error: 'ID no definido' };
      }

      let linkId = this.getLinkFirestoreIdFromGanttId(ganttId!);

      if (!linkId) {
        // Try by source/target match in cache
        if (data.source && data.target) {
          const sourceId = String(data.source);
          const targetId = String(data.target);
          for (const [id, link] of this.linkCache.entries()) {
            if (link.sourceTaskId === sourceId && link.targetTaskId === targetId) {
              linkId = id;
              break;
            }
          }
        }

        if (!linkId && this._ganttApi && this._ganttApi.getLink) {
          const ganttLink = this._ganttApi.getLink(ganttId);
          if (ganttLink && ganttLink.source && ganttLink.target) {
            const sourceId = String(ganttLink.source);
            const targetId = String(ganttLink.target);
            for (const [id, link] of this.linkCache.entries()) {
              if (link.sourceTaskId === sourceId && link.targetTaskId === targetId) {
                linkId = id;
                break;
              }
            }
          }
        }

        if (!linkId) {
          return { success: false, error: 'No se encontró el ID para el enlace' };
        }
      }

      await TaskLinkService.deleteLink(linkId);
      this.linkCache.delete(linkId);

      return { success: true, id: linkId };
    } catch (error) {
      console.error('FirestoreGanttDataProvider: Error eliminando enlace:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al eliminar enlace'
      };
    }
  }

  destroy(): void {
    this.listeners.clear();
    this.tempIdMapping.clear();
    this.taskCache.clear();
    this.linkCache.clear();
  }
}
