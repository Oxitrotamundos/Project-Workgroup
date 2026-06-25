import { apiClient, ApiError } from '../lib/apiClient';
import { wouldCreateCycle, type CycleEdge } from '../utils/cycleDetector';
import type { TaskLinkResponse } from '@project-workgroup/shared';
import type {
  TaskLink,
  CreateTaskLinkData,
  UpdateTaskLinkData,
  TaskLinkFilters
} from '../types/domain';

const toDomain = (r: TaskLinkResponse): TaskLink => ({
  id: r.id,
  projectId: r.projectId,
  sourceTaskId: r.sourceTaskId,
  targetTaskId: r.targetTaskId,
  type: r.type,
  createdAt: r.createdAt ?? '',
  updatedAt: r.updatedAt ?? '',
});


export class TaskLinkService {

  static async createLink(data: CreateTaskLinkData): Promise<string> {
    return (await this.createLinkWithResponse(data)).id;
  }

  static async createLinkWithResponse(data: CreateTaskLinkData): Promise<TaskLink> {
    if (data.sourceTaskId === data.targetTaskId) {
      throw new Error('No se puede crear un enlace de una tarea a sí misma');
    }
    const result = await apiClient.post<TaskLinkResponse>(`/v1/projects/${data.projectId}/task-links`, {
      sourceTaskId: data.sourceTaskId,
      targetTaskId: data.targetTaskId,
      type: data.type,
    });
    return toDomain(result);
  }

  static async getLink(id: string): Promise<TaskLink | null> {
    try {
      const result = await apiClient.get<TaskLinkResponse>(`/v1/task-links/${id}`);
      return toDomain(result);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  static async getProjectLinks(projectId: string, _filters?: TaskLinkFilters): Promise<TaskLink[]> {
    try {
      const result = await apiClient.get<TaskLinkResponse[]>(`/v1/projects/${projectId}/task-links`);
      return result.map(toDomain);
    } catch (error) {
      console.error('Error getting project links:', error);
      return [];
    }
  }

  static async getTaskSourceLinks(taskId: string): Promise<TaskLink[]> {
    try {
      const result = await apiClient.get<TaskLinkResponse[]>(`/v1/tasks/${taskId}/source-links`);
      return result.map(toDomain);
    } catch {
      return [];
    }
  }

  static async getTaskTargetLinks(taskId: string): Promise<TaskLink[]> {
    try {
      const result = await apiClient.get<TaskLinkResponse[]>(`/v1/tasks/${taskId}/target-links`);
      return result.map(toDomain);
    } catch {
      return [];
    }
  }

  static async updateLink(id: string, data: UpdateTaskLinkData): Promise<TaskLink> {
    const result = await apiClient.patch<TaskLinkResponse>(`/v1/task-links/${id}`, data);
    return toDomain(result);
  }

  static async deleteLink(id: string): Promise<void> {
    await apiClient.delete(`/v1/task-links/${id}`);
  }

  static async deleteTaskLinks(_taskId: string): Promise<void> {
  }

  static async validateLinkCreation(
    sourceTaskId: string,
    targetTaskId: string,
    projectId: string
  ): Promise<{ valid: boolean; error?: string }> {
    if (sourceTaskId === targetTaskId) {
      return { valid: false, error: 'No se puede crear un enlace de una tarea a sí misma' };
    }
    const links = await TaskLinkService.getProjectLinks(projectId);
    const edges: CycleEdge[] = links.map((l) => ({
      sourceTaskId: l.sourceTaskId,
      targetTaskId: l.targetTaskId,
    }));
    if (wouldCreateCycle(edges, sourceTaskId, targetTaskId)) {
      return { valid: false, error: 'Crear este enlace generaría una dependencia circular' };
    }
    return { valid: true };
  }

  static async detectCircularDependency(
    projectId: string,
    source: string,
    target: string
  ): Promise<boolean> {
    const links = await TaskLinkService.getProjectLinks(projectId);
    const edges: CycleEdge[] = links.map((l) => ({
      sourceTaskId: l.sourceTaskId,
      targetTaskId: l.targetTaskId,
    }));
    return wouldCreateCycle(edges, source, target);
  }
}

export default TaskLinkService;
