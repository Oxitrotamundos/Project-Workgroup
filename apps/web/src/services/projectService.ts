import { apiClient } from '../lib/apiClient';
import type {
  Project,
  CreateProjectData,
  UpdateProjectData,
  ProjectFilters,
  PaginatedResponse
} from '../types/domain';

const toDomain = (r: any): Project => ({
  id: r.id,
  name: r.name,
  description: r.description ?? '',
  startDate: r.startDate ?? '',
  endDate: r.endDate ?? '',
  status: r.status,
  ownerId: r.ownerId,
  members: r.members ?? [],
  color: r.color ?? '#3B82F6',
  createdAt: r.createdAt ?? '',
  updatedAt: r.updatedAt ?? '',
});

export class ProjectService {

  static async createProject(data: CreateProjectData): Promise<string> {
    const result = await apiClient.post<any>('/v1/projects', {
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status,
      color: data.color,
    });
    return result.id;
  }

  static async getProject(id: string): Promise<Project | null> {
    try {
      const result = await apiClient.get<any>(`/v1/projects/${id}`);
      return toDomain(result);
    } catch (error: any) {
      if (error?.status === 404) return null;
      console.error('Error getting project:', error);
      throw new Error('Error al obtener el proyecto');
    }
  }

  static async getUserProjects(
    _userId: string,
    _filters?: ProjectFilters,
    pageSize: number = 10
  ): Promise<PaginatedResponse<Project>> {
    try {
      const res = await apiClient.get<any[]>('/v1/projects');
      const items = res.map(toDomain);
      return {
        items: items.slice(0, pageSize),
        total: items.length,
        page: 1,
        pageSize,
        hasMore: items.length > pageSize,
      };
    } catch (error) {
      console.error('Error getting user projects:', error);
      return { items: [], total: 0, page: 1, pageSize, hasMore: false };
    }
  }

  static async updateProject(id: string, data: UpdateProjectData): Promise<void> {
    await apiClient.patch(`/v1/projects/${id}`, data);
  }

  static async deleteProject(id: string): Promise<void> {
    await apiClient.delete(`/v1/projects/${id}`);
  }

  static async addMember(projectId: string, userId: string): Promise<void> {
    await apiClient.post(`/v1/projects/${projectId}/members`, { userId, projectRole: 'contributor' });
  }

  static async removeMember(projectId: string, userId: string): Promise<void> {
    await apiClient.delete(`/v1/projects/${projectId}/members/${userId}`);
  }

  static async hasAccess(projectId: string, _userId: string): Promise<boolean> {
    try {
      await apiClient.get(`/v1/projects/${projectId}`);
      return true;
    } catch {
      return false;
    }
  }

  static async getAllProjects(
    _filters?: ProjectFilters,
    pageSize: number = 10,
    _lastDoc?: any
  ): Promise<PaginatedResponse<Project>> {
    try {
      const res = await apiClient.get<any[]>('/v1/projects');
      const items = res.map(toDomain);
      return {
        items: items.slice(0, pageSize),
        total: items.length,
        page: 1,
        pageSize,
        hasMore: items.length > pageSize,
      };
    } catch (error) {
      console.error('Error getting all projects:', error);
      throw new Error('Error al obtener todos los proyectos');
    }
  }

  static async getProjectStats() {
    return {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      blockedTasks: 0,
      totalEstimatedHours: 0,
      totalActualHours: 0,
      progressPercentage: 0,
      membersCount: 0
    };
  }
}

export default ProjectService;