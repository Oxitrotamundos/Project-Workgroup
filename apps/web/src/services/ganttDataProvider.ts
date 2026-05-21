import { TaskService } from './taskService';
import { TaskLinkService } from './taskLinkService';
import type {
  Task,
  TaskLink,
  GanttLinkData,
  GanttLinkResponse,
  UpdateTaskLinkData,
} from '../types/domain';
import type { SummaryPatch, UpdateTaskDto } from '@project-workgroup/shared';
import { wouldCreateCycle, type CycleEdge } from '../utils/cycleDetector';
import { mergeSummaryPatchIntoTask } from '../lib/summaryPatches';
import type {
  GanttApi,
  GanttActionPayloadMap,
  GanttId,
  GanttTask,
} from 'wx-react-gantt';

const toIsoDateTime = (value: Date | string | undefined | null): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
  }
  return undefined;
};

export const toGanttId = (id: string | number | bigint | null | undefined): GanttId | undefined => {
  if (id === undefined || id === null || id === '') return undefined;
  if (typeof id === 'number') return id;
  if (typeof id === 'bigint') {
    const n = Number(id);
    return Number.isSafeInteger(n) ? n : String(id);
  }
  const n = Number(id);
  return Number.isSafeInteger(n) ? n : id;
};

export interface GanttDataProviderData {
  tasks: GanttTask[];
  links: GanttLinkData[];
}

export type GanttErrorCallback = (err: { message: string; cause?: unknown }) => void;

export interface GanttDataChangePayload {
  updated: Task[];
  deleted: string[];
  summariesPatched?: SummaryPatch[];
  refresh?: boolean;
}

export type GanttDataChangeCallback = (payload: GanttDataChangePayload) => void;

export interface GanttLinkChangePayload {
  updated: TaskLink[];
  deleted: string[];
}

export type GanttLinkChangeCallback = (payload: GanttLinkChangePayload) => void;

type PendingQueuedAction = {
  timer: ReturnType<typeof setTimeout>;
  resolvers: Array<{ resolve: (value: unknown) => void; reject: (err: unknown) => void }>;
};

export class GanttDataProvider {
  private projectId: string;
  private listeners: Map<string, Array<(data: unknown) => void>> = new Map();
  private _ganttApi: GanttApi | null = null;
  private tempIdMapping: Map<string, string> = new Map();
  private taskCache: Map<string, Task> = new Map();
  private linkCache: Map<string, TaskLink> = new Map();
  private onError: GanttErrorCallback | null = null;
  private onDataChange: GanttDataChangeCallback | null = null;
  private onLinkChange: GanttLinkChangeCallback | null = null;
  private pendingUpdated: Map<string, Task> = new Map();
  private pendingDeleted: Set<string> = new Set();
  private pendingRefresh = false;
  private pendingOpenStates: Map<string, boolean> = new Map();
  private dataChangeDebounceMs = 200;
  private dataChangeTimer: ReturnType<typeof setTimeout> | null = null;
  private openStateDebounceMs = 350;
  private openStateTimer: ReturnType<typeof setTimeout> | null = null;
  private throttleMs = 150;
  private pendingActions: Map<string, PendingQueuedAction> = new Map();

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  setOnError(cb: GanttErrorCallback | null): void {
    this.onError = cb;
  }

  setOnDataChange(cb: GanttDataChangeCallback | null): void {
    this.onDataChange = cb;
  }

  setOnLinkChange(cb: GanttLinkChangeCallback | null): void {
    this.onLinkChange = cb;
  }

  syncFromTasks(tasks: Task[]): void {
    const incomingIds = new Set<string>();

    for (const fresh of tasks) {
      incomingIds.add(fresh.id);
      const cached = this.taskCache.get(fresh.id);
      const sameShape =
        !!cached &&
        cached.version === fresh.version &&
        cached.duration === fresh.duration &&
        cached.estimatedHours === fresh.estimatedHours &&
        cached.startDate === fresh.startDate &&
        cached.endDate === fresh.endDate &&
        cached.status === fresh.status &&
        cached.progress === fresh.progress &&
        cached.name === fresh.name &&
        cached.type === fresh.type &&
        cached.parentId === fresh.parentId &&
        cached.order === fresh.order &&
        cached.open === fresh.open;
      if (sameShape) continue;

      this.taskCache.set(fresh.id, fresh);
      const ganttTask = this.toGanttTask(fresh);
      if (ganttTask && this._ganttApi && ganttTask.id !== undefined) {
        try {
          this._ganttApi.exec('update-task', {
            id: ganttTask.id,
            task: ganttTask,
            _silent: true,
          });
        } catch (e) {
          console.warn('GanttDataProvider: syncFromTasks update-task falló', e);
        }
      }
    }

    for (const cachedId of Array.from(this.taskCache.keys())) {
      if (incomingIds.has(cachedId)) continue;
      this.taskCache.delete(cachedId);
      const ganttId = toGanttId(cachedId);
      if (ganttId !== undefined && this._ganttApi) {
        try {
          this._ganttApi.exec('delete-task', { id: ganttId, _silent: true });
        } catch (e) {
          console.warn('GanttDataProvider: syncFromTasks delete-task falló', e);
        }
      }
    }
  }

  syncFromData(tasks: Task[], links: TaskLink[]): GanttDataProviderData {
    this.syncFromTasks(tasks);
    this.syncFromLinks(links);
    return this.toGanttData(tasks, links);
  }

  syncFromLinks(links: TaskLink[]): void {
    const incomingIds = new Set<string>();
    for (const link of links) {
      incomingIds.add(link.id);
      this.linkCache.set(link.id, link);
    }
    for (const cachedId of Array.from(this.linkCache.keys())) {
      if (!cachedId.startsWith('temp://') && !incomingIds.has(cachedId)) {
        this.linkCache.delete(cachedId);
      }
    }
  }

  private toGanttData(tasks: Task[], links: TaskLink[]): GanttDataProviderData {
    const ganttTasks = tasks
      .map((task) => this.toGanttTask(task, tasks))
      .filter((t): t is GanttTask => t !== null);

    const ganttLinks = links
      .map((link) => this.toGanttLink(link))
      .filter((l): l is GanttLinkData => l !== null);

    return { tasks: ganttTasks, links: ganttLinks };
  }

  private toGanttLink(link: TaskLink): GanttLinkData | null {
    const id = toGanttId(link.id);
    const source = toGanttId(link.sourceTaskId);
    const target = toGanttId(link.targetTaskId);
    if (id === undefined || source === undefined || target === undefined) return null;
    return { id, source, target, type: link.type };
  }

  private markTaskUpdated(task: Task, refresh = false): void {
    this.pendingDeleted.delete(task.id);
    this.pendingUpdated.set(task.id, task);
    this.pendingRefresh = this.pendingRefresh || refresh;
    this.scheduleDataChange();
  }

  private markTaskDeleted(taskId: string, refresh = false): void {
    this.pendingUpdated.delete(taskId);
    this.pendingDeleted.add(taskId);
    this.pendingRefresh = this.pendingRefresh || refresh;
    this.scheduleDataChange();
  }

  private applySummaryPatches(patches: SummaryPatch[] | undefined): void {
    if (!patches?.length) return;
    for (const patch of patches) {
      const cached = this.taskCache.get(patch.id);
      if (!cached) continue;
      const updated = mergeSummaryPatchIntoTask(cached, patch);
      this.taskCache.set(updated.id, updated);
      this.markTaskUpdated(updated);
      const ganttTask = this.toGanttTask(updated);
      if (ganttTask && this._ganttApi && ganttTask.id !== undefined) {
        this._ganttApi.exec('update-task', {
          id: ganttTask.id,
          task: ganttTask,
          _silent: true,
        });
      }
    }
  }

  private markLinkUpdated(link: TaskLink): void {
    this.linkCache.set(link.id, link);
    this.onLinkChange?.({ updated: [link], deleted: [] });
  }

  private markLinkDeleted(linkId: string): void {
    this.linkCache.delete(linkId);
    this.onLinkChange?.({ updated: [], deleted: [linkId] });
  }

  private scheduleDataChange(): void {
    if (!this.onDataChange) return;
    if (this.dataChangeTimer !== null) clearTimeout(this.dataChangeTimer);
    this.dataChangeTimer = setTimeout(() => {
      this.dataChangeTimer = null;
      if (this.pendingUpdated.size === 0 && this.pendingDeleted.size === 0) return;
      const payload: GanttDataChangePayload = {
        updated: Array.from(this.pendingUpdated.values()),
        deleted: Array.from(this.pendingDeleted),
        refresh: this.pendingRefresh,
      };
      this.pendingUpdated.clear();
      this.pendingDeleted.clear();
      this.pendingRefresh = false;
      this.onDataChange?.(payload);
    }, this.dataChangeDebounceMs);
  }

  getTaskIdFromGanttId(ganttId: GanttId): string | undefined {
    if (typeof ganttId === 'string' && ganttId.startsWith('temp://')) {
      return this.tempIdMapping.get(ganttId);
    }
    return String(ganttId);
  }

  getFullTaskData(taskId: string): Task | undefined {
    return this.taskCache.get(taskId);
  }

  getFullTaskDataByGanttId(ganttId: GanttId): Task | undefined {
    return this.getFullTaskData(String(ganttId));
  }

  getLinkIdFromGanttId(ganttId: GanttId): string | undefined {
    if (typeof ganttId === 'string' && ganttId.startsWith('temp://')) {
      return this.linkCache.get(ganttId)?.id;
    }
    return String(ganttId);
  }

  getFullLinkData(linkId: string): TaskLink | undefined {
    return this.linkCache.get(linkId);
  }

  getFullLinkDataByGanttId(ganttId: GanttId): TaskLink | undefined {
    const linkId = this.getLinkIdFromGanttId(ganttId);
    return linkId ? this.getFullLinkData(linkId) : undefined;
  }

  setGanttApi(api: GanttApi): void {
    this._ganttApi = api;
  }

  setNext(): void {
  }

  private isUiOnlyEvent(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const d = data as { inProgress?: boolean; _rollback?: boolean; _silent?: boolean; _addTaskSync?: boolean };
    return Boolean(d.inProgress || d._rollback || d._silent || d._addTaskSync);
  }

  async exec(action: string, data: unknown): Promise<unknown> {
    return this.send(action, data);
  }

  async getData(): Promise<GanttDataProviderData> {
    const [tasks, links] = await Promise.all([
      TaskService.getProjectTasks(this.projectId),
      TaskLinkService.getProjectLinks(this.projectId),
    ]);

    this.taskCache.clear();
    this.linkCache.clear();

    tasks.forEach((task: Task) => this.taskCache.set(task.id, task));
    links.forEach((link: TaskLink) => this.linkCache.set(link.id, link));

    return this.toGanttData(tasks, links);
  }

  private toGanttTask(task: Task, allTasks?: Task[]): GanttTask | null {
    if (!task.id || !task.name) return null;

    let startDate: Date;
    let endDate: Date;
    try {
      startDate = task.startDate ? new Date(task.startDate) : new Date();
      endDate = task.endDate ? new Date(task.endDate) : new Date(Date.now() + 86_400_000);
      if (Number.isNaN(startDate.getTime())) startDate = new Date();
      if (Number.isNaN(endDate.getTime())) endDate = new Date(Date.now() + 86_400_000);
    } catch {
      startDate = new Date();
      endDate = new Date(Date.now() + 86_400_000);
    }

    if (task.type !== 'milestone' && endDate.getTime() <= startDate.getTime()) {
      endDate = new Date(startDate.getTime() + 86_400_000);
    }

    const durationInDays = Number.isFinite(task.duration) ? task.duration : 0;

    const ganttId = toGanttId(task.id);
    if (ganttId === undefined) return null;

    const ganttTask: GanttTask = {
      id: ganttId,
      text: task.name,
      start: startDate,
      end: endDate,
      duration: durationInDays,
      progress: typeof task.progress === 'number' ? task.progress : 0,
      type: task.type || 'task',
      parent: toGanttId(task.parentId) ?? 0,
      estimatedHours: Number.isFinite(task.estimatedHours) ? task.estimatedHours : undefined,
      hoursPerDay: Number.isFinite(task.hoursPerDay) ? task.hoursPerDay : undefined,
      status: task.status,
      priority: task.priority,
    } as GanttTask & { status: string; priority: string };

    if (allTasks) {
      const hasChildren = allTasks.some((t) => t.parentId === task.id);
      if (hasChildren) ganttTask.open = task.open !== false;
    }

    return ganttTask;
  }

  private enqueueAction(
    key: string,
    run: () => Promise<unknown>,
  ): Promise<unknown> {
    const existing = this.pendingActions.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      existing.resolvers.forEach(({ resolve }) => resolve({ success: true, superseded: true }));
      this.pendingActions.delete(key);
    }

    return new Promise((resolve, reject) => {
      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const timer = setTimeout(async () => {
        this.pendingActions.delete(key);
        try {
          const result = await run();
          const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
          this.emitMetric('persist-action', { key, durationMs: Math.round(durationMs) });
          resolve(result);
        } catch (err) {
          console.error('GanttDataProvider: error procesando acción', key, err);
          reject(err);
        }
      }, this.throttleMs);
      this.pendingActions.set(key, { timer, resolvers: [{ resolve, reject }] });
    });
  }

  private emitMetric(name: string, detail: Record<string, unknown>): void {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent(`pwg:gantt:${name}`, { detail }));
  }

  async send(action: string, data: unknown): Promise<unknown> {

    if (this.isUiOnlyEvent(data)) return { success: true };
    if (action === 'drag-task') return { success: true };

    if (action === 'update-task' || action === 'move-task') {
      const taskId = this.resolveTaskId((data as { id?: GanttId }).id);
      if (taskId) {
        const key = `${action}:${taskId}`;
        return this.enqueueAction(key, () =>
          action === 'update-task'
            ? this.handleUpdateTask(data as GanttActionPayloadMap['update-task'])
            : this.handleMoveTask(data as GanttActionPayloadMap['move-task']),
        );
      }
    }

    try {
      switch (action) {
        case 'add-task':
          return await this.handleAddTask(data as GanttActionPayloadMap['add-task']);
        case 'update-task':
          return await this.handleUpdateTask(data as GanttActionPayloadMap['update-task']);
        case 'delete-task':
          return await this.handleDeleteTask(data as GanttActionPayloadMap['delete-task']);
        case 'move-task':
          return await this.handleMoveTask(data as GanttActionPayloadMap['move-task']);
        case 'add-link':
          return await this.handleAddLink(data as GanttActionPayloadMap['add-link']);
        case 'update-link':
          return await this.handleUpdateLink(data as GanttActionPayloadMap['update-link']);
        case 'delete-link':
          return await this.handleDeleteLink(data as GanttActionPayloadMap['delete-link']);
        default:
          return { success: true };
      }
    } catch (error) {
      console.error('GanttDataProvider: error procesando acción', action, error);
      throw error;
    }
  }

  private applyEntityUpdate(taskId: string, fresh: Task, summariesPatched?: SummaryPatch[]): void {
    this.taskCache.set(taskId, fresh);
    this.markTaskUpdated(fresh);
    const ganttTask = this.toGanttTask(fresh);
    if (ganttTask && this._ganttApi && ganttTask.id !== undefined) {
      this._ganttApi.exec('update-task', {
        id: ganttTask.id,
        task: ganttTask,
        _silent: true,
      });
    }
    this.applySummaryPatches(summariesPatched);
  }

  private async handleAddTask(data: GanttActionPayloadMap['add-task']): Promise<unknown> {
    const { taskManager } = await import('./taskManager');

    const parentId =
      data.mode === 'child' && data.target ? this.getTaskIdFromGanttId(data.target) : undefined;

    let taskId: string;
    if (parentId) {
      taskId = await taskManager.createSubtask(parentId, {
        projectId: this.projectId,
        name: data.text || 'Nueva Subtarea',
        description: data.details || '',
        startDate: data.start,
        endDate: data.end,
        priority: 'medium',
        type: data.type || 'task',
        skipEvent: true,
      });
    } else {
      taskId = await taskManager.createTask({
        projectId: this.projectId,
        name: data.text || 'Nueva Tarea',
        description: data.details || '',
        startDate: data.start,
        endDate: data.end,
        priority: 'medium',
        type: data.type || 'task',
        skipEvent: true,
      });
    }

    if (data.id !== undefined && typeof data.id === 'string' && data.id.startsWith('temp://')) {
      this.tempIdMapping.set(data.id, taskId);
    }

    const created = await TaskService.getTask(taskId);
    if (created) {
      this.taskCache.set(taskId, created);
      this.markTaskUpdated(created, true);
      const ganttTask = this.toGanttTask(created);
      if (ganttTask && this._ganttApi && data.id !== undefined && ganttTask.id !== undefined) {
        this._ganttApi.exec('update-task', {
          id: data.id,
          task: { ...ganttTask, id: ganttTask.id },
          _addTaskSync: true,
        });
      }
    }

    return { success: true, id: taskId };
  }

  private async handleUpdateTask(data: GanttActionPayloadMap['update-task']): Promise<unknown> {
    const taskId = this.resolveTaskId(data.id);
    if (!taskId) throw new Error('ID de tarea requerido para actualización');

    const taskData: Partial<GanttTask> = data.task && typeof data.task === 'object' ? data.task : {};
    const cachedForVersion = this.taskCache.get(taskId);
    const isSummary = (taskData.type ?? cachedForVersion?.type) === 'summary';

    const updateData: UpdateTaskDto = {};

    const nextName = taskData.text;
    if (nextName !== undefined && String(nextName) !== cachedForVersion?.name) {
      updateData.name = String(nextName);
    }

    const nextDescription = taskData.details;
    if (nextDescription !== undefined && String(nextDescription) !== (cachedForVersion?.description ?? '')) {
      updateData.description = String(nextDescription);
    }

    if (!isSummary) {
      const nextStart = toIsoDateTime(taskData.start);
      const cachedStart = toIsoDateTime(cachedForVersion?.startDate);
      if (nextStart !== undefined && nextStart !== cachedStart) {
        updateData.startDate = nextStart;
      }
      const nextEnd = toIsoDateTime(taskData.end);
      const cachedEnd = toIsoDateTime(cachedForVersion?.endDate);
      if (nextEnd !== undefined && nextEnd !== cachedEnd) {
        updateData.endDate = nextEnd;
      }
    }

    if (taskData.type !== undefined && taskData.type !== cachedForVersion?.type) {
      updateData.type = taskData.type;
    }

    if (!isSummary && taskData.progress !== undefined && Number.isFinite(taskData.progress)) {
      const nextProgress = Math.max(0, Math.min(100, Math.round(Number(taskData.progress))));
      if (!cachedForVersion || cachedForVersion.progress !== nextProgress) {
        updateData.progress = nextProgress;
      }
    }

    const hasMeaningfulChange = Object.keys(updateData).length > 0;
    if (hasMeaningfulChange && cachedForVersion?.version !== undefined) {
      updateData.expectedVersion = cachedForVersion.version;
    }

    if (!hasMeaningfulChange) return { success: true };

    const cached = this.taskCache.get(taskId);
    const ganttPrev = this._ganttApi?.getTask?.(taskId);
    const snapshot = {
      start: cached?.startDate ? new Date(cached.startDate) : ganttPrev?.start,
      end: cached?.endDate ? new Date(cached.endDate) : ganttPrev?.end,
      duration: ganttPrev?.duration,
      progress: cached?.progress ?? ganttPrev?.progress,
      text: cached?.name ?? ganttPrev?.text,
    };

    try {
      const result = await TaskService.updateTaskWithMeta(taskId, updateData);
      this.applyEntityUpdate(taskId, result.task, result.summariesPatched);
      return { success: true };
    } catch (error) {
      console.error('GanttDataProvider: error en update-task, revirtiendo UI', error);
      if (this._ganttApi && ganttPrev) {
        try {
          this._ganttApi.exec('update-task', {
            id: taskId,
            task: {
              start: snapshot.start,
              end: snapshot.end,
              duration: snapshot.duration,
              progress: snapshot.progress,
              text: snapshot.text,
            },
            _rollback: true,
          });
        } catch (rollbackError) {
          console.error('GanttDataProvider: error en rollback visual', rollbackError);
        }
      }
      const message = 'No se pudo guardar el cambio. Se revirtió.';
      this.emitMetric('rollback', { action: 'update-task', taskId, message });
      this.onError?.({ message, cause: error });
      throw error;
    }
  }

  private async handleDeleteTask(data: GanttActionPayloadMap['delete-task']): Promise<unknown> {
    const taskId = this.resolveTaskId(data.id);
    if (!taskId) throw new Error('ID de tarea requerido para eliminación');

    await TaskService.deleteTask(taskId);
    this.taskCache.delete(taskId);
    this.markTaskDeleted(taskId, true);
    return { success: true };
  }

  private async handleMoveTask(data: GanttActionPayloadMap['move-task']): Promise<unknown> {
    const movedTaskId = this.resolveTaskId(data.id);
    if (!movedTaskId) {
      console.error('GanttDataProvider: move-task sin ID resoluble');
      return { success: false };
    }
    const targetTaskId = data.target ? this.getTaskIdFromGanttId(data.target) ?? null : null;

    let newParentId: string | null = null;
    if (this._ganttApi) {
      const movedTask = this._ganttApi.getTask(data.id);
      if (movedTask?.parent && movedTask.parent !== 0 && movedTask.parent !== '0') {
        newParentId = this.getTaskIdFromGanttId(movedTask.parent) ?? String(movedTask.parent);
      }
    }

    try {
      const cachedMoved = this.taskCache.get(movedTaskId);
      const mode = (data.mode as 'before' | 'after' | 'child' | undefined) ?? 'after';
      const positionData: {
        parentId?: string | null;
        afterTaskId?: string;
        beforeTaskId?: string;
        expectedVersion?: number;
      } = {
        parentId: newParentId,
      };
      if (targetTaskId) {
        if (mode === 'before') positionData.beforeTaskId = targetTaskId;
        else positionData.afterTaskId = targetTaskId;
      }
      if (cachedMoved?.version !== undefined) positionData.expectedVersion = cachedMoved.version;

      const result = await TaskService.updateTaskPosition(
        movedTaskId,
        positionData,
      );
      this.applyEntityUpdate(movedTaskId, result.task, result.summariesPatched);
      return { success: true };
    } catch (error) {
      console.error('GanttDataProvider: error al mover tarea', error);
      const message = 'No se pudo mover la tarea. Se revirtió.';
      this.emitMetric('rollback', { action: 'move-task', taskId: movedTaskId, message });
      this.onError?.({ message, cause: error });
      throw error;
    }
  }

  private async handleAddLink(data: GanttActionPayloadMap['add-link']): Promise<GanttLinkResponse> {
    const linkPayload = data.link ?? data;
    const sourceId = (linkPayload as { source?: GanttId }).source;
    const targetId = (linkPayload as { target?: GanttId }).target;
    const linkType = (linkPayload as { type?: TaskLink['type'] }).type;
    const tempId = data.id;

    if (sourceId === undefined || targetId === undefined || !linkType) {
      return { success: false, error: 'Datos de enlace incompletos' };
    }

    const sourceTaskId = this.getTaskIdFromGanttId(sourceId) ?? String(sourceId);
    const targetTaskId = this.getTaskIdFromGanttId(targetId) ?? String(targetId);

    if (sourceTaskId === targetTaskId) {
      return { success: false, error: 'No se puede crear un enlace de una tarea a sí misma' };
    }
    const edges: CycleEdge[] = Array.from(this.linkCache.values()).map((link) => ({
      sourceTaskId: link.sourceTaskId,
      targetTaskId: link.targetTaskId,
    }));
    if (wouldCreateCycle(edges, sourceTaskId, targetTaskId)) {
      return { success: false, error: 'Crear este enlace generaría una dependencia circular' };
    }

    try {
      const newLink = await TaskLinkService.createLinkWithResponse({
        projectId: this.projectId,
        sourceTaskId,
        targetTaskId,
        type: linkType,
      });
      this.markLinkUpdated(newLink);
      if (tempId !== undefined) this.linkCache.set(String(tempId), newLink);
      if (tempId !== undefined && this._ganttApi) {
        const linkGanttId = toGanttId(newLink.id);
        const sourceGanttId = toGanttId(sourceTaskId);
        const targetGanttId = toGanttId(targetTaskId);
        if (
          linkGanttId !== undefined &&
          sourceGanttId !== undefined &&
          targetGanttId !== undefined
        ) {
          this._ganttApi.exec('update-link', {
            id: tempId,
            link: { id: linkGanttId, source: sourceGanttId, target: targetGanttId, type: linkType },
            _silent: true,
          });
        }
      }
      return { success: true, id: newLink.id };
    } catch (error) {
      console.error('GanttDataProvider: error creando enlace', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al crear enlace',
      };
    }
  }

  private async handleUpdateLink(data: GanttActionPayloadMap['update-link']): Promise<GanttLinkResponse> {
    const linkId = this.getLinkIdFromGanttId(data.id);
    if (!linkId) return { success: false, error: 'No se encontró el ID del enlace' };

    const updateData: UpdateTaskLinkData = {};
    if (data.link?.type !== undefined) updateData.type = data.link.type;
    if (Object.keys(updateData).length === 0) return { success: true, id: linkId };

    try {
      const updatedLink = await TaskLinkService.updateLink(linkId, updateData);
      this.markLinkUpdated(updatedLink);
      return { success: true, id: linkId };
    } catch (error) {
      console.error('GanttDataProvider: error actualizando enlace', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al actualizar enlace',
      };
    }
  }

  private async handleDeleteLink(data: GanttActionPayloadMap['delete-link']): Promise<GanttLinkResponse> {
    const linkId = this.getLinkIdFromGanttId(data.id);
    if (!linkId) return { success: false, error: 'No se encontró el ID del enlace' };

    try {
      await TaskLinkService.deleteLink(linkId);
      this.markLinkDeleted(linkId);
      return { success: true, id: linkId };
    } catch (error) {
      console.error('GanttDataProvider: error eliminando enlace', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al eliminar enlace',
      };
    }
  }

  async handleExpandCollapseState(args: { id: GanttId; isOpen: boolean }): Promise<void> {
    const taskId = String(args.id);
    const cached = this.taskCache.get(taskId);
    if (cached?.open === args.isOpen) return;

    if (cached) {
      const updated = { ...cached, open: args.isOpen };
      this.taskCache.set(taskId, updated);
      this.markTaskUpdated(updated);
    }
    this.pendingOpenStates.set(taskId, args.isOpen);
    this.scheduleOpenStateFlush();
  }

  private scheduleOpenStateFlush(): void {
    if (this.openStateTimer !== null) clearTimeout(this.openStateTimer);
    this.openStateTimer = setTimeout(() => {
      this.openStateTimer = null;
      void this.flushOpenStates();
    }, this.openStateDebounceMs);
  }

  private async flushOpenStates(): Promise<void> {
    if (this.pendingOpenStates.size === 0) return;
    const states = Array.from(this.pendingOpenStates, ([id, open]) => {
      const cached = this.taskCache.get(id);
      return cached?.version !== undefined
        ? { id, open, expectedVersion: cached.version }
        : { id, open };
    });
    this.pendingOpenStates.clear();
    try {
      const result = await TaskService.updateOpenStates(this.projectId, states);
      for (const item of result.updated) {
        const cached = this.taskCache.get(item.id);
        if (!cached) continue;
        const next: Task = { ...cached, open: item.open, version: item.version };
        this.taskCache.set(item.id, next);
        this.markTaskUpdated(next);
      }
      if (result.conflicts && result.conflicts.length > 0) {
        this.emitMetric('rollback', {
          action: 'open-states',
          conflicts: result.conflicts.length,
        });
        this.onError?.({
          message: 'Algunos cambios de expandir/colapsar no se guardaron por conflicto.',
          cause: result.conflicts,
        });
      }
      this.emitMetric('open-states', {
        count: states.length,
        updated: result.updated.length,
        conflicts: result.conflicts?.length ?? 0,
      });
    } catch (error) {
      console.error('GanttDataProvider: error sincronizando expand/collapse', error);
      this.emitMetric('rollback', { action: 'open-states', message: 'network' });
      this.onError?.({ message: 'No se pudo guardar el estado expandido.', cause: error });
    }
  }

  async reconcileExpansionStates(api: GanttApi): Promise<void> {
    const state = api.getState();
    if (!state) return;
    const tasks = state._tasks ?? state.tasks ?? [];
    for (const ganttTask of tasks) {
      if (!ganttTask.data || ganttTask.data.length === 0) continue;
      const cached = this.taskCache.get(String(ganttTask.id));
      if (!cached) continue;
      const currentOpen = ganttTask.open !== false;
      if (cached.open === currentOpen) continue;
      await this.handleExpandCollapseState({ id: ganttTask.id, isOpen: currentOpen });
    }
  }

  private resolveTaskId(rawId: GanttId | undefined): string | undefined {
    if (rawId === undefined || rawId === null) return undefined;
    if (typeof rawId === 'string' && rawId.startsWith('temp://')) {
      return this.tempIdMapping.get(rawId);
    }
    return String(rawId);
  }

  on(event: string, callback: (data: unknown) => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(callback);
    this.listeners.set(event, list);
  }

  destroy(): void {
    this.listeners.clear();
    this.tempIdMapping.clear();
    this.taskCache.clear();
    this.linkCache.clear();
    this.pendingActions.forEach((entry) => {
      clearTimeout(entry.timer);
      entry.resolvers.forEach(({ resolve }) => resolve({ success: true, superseded: true }));
    });
    this.pendingActions.clear();
    if (this.dataChangeTimer !== null) {
      clearTimeout(this.dataChangeTimer);
      this.dataChangeTimer = null;
    }
    if (this.openStateTimer !== null) {
      clearTimeout(this.openStateTimer);
      this.openStateTimer = null;
      void this.flushOpenStates();
    }
    this.onDataChange = null;
    this.onLinkChange = null;
    this._ganttApi = null;
  }
}
