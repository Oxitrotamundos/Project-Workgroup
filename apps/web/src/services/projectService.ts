import { apiClient, ApiError } from '../lib/apiClient';
import type {
  Project,
  CreateProjectData,
  UpdateProjectData,
  ProjectFilters,
  PaginatedResponse
} from '../types/domain';
import type {
  ProjectResponse,
  ProjectSettingsResponse,
  UpdateProjectSettingsDto,
} from '@project-workgroup/shared';

// La API no incluye `members` en ProjectResponse; lo extendemos opcionalmente.
type RawProject = ProjectResponse & { members?: string[] };

interface RawProjectsPage {
  items?: RawProject[];
  total?: number;
  hasMore?: boolean;
  nextCursor?: string | null;
  page?: number;
  lastDoc?: unknown;
}

const toDomain = (r: RawProject): Project => ({
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

const toPaginatedProjects = (res: RawProjectsPage, pageSize: number): PaginatedResponse<Project> => {
  const items = (res.items ?? []).map(toDomain);
  const total = typeof res.total === 'number' ? res.total : items.length;
  const hasMore = typeof res.hasMore === 'boolean' ? res.hasMore : Boolean(res.nextCursor) || items.length > pageSize;

  return {
    items: items.slice(0, pageSize),
    total,
    page: typeof res.page === 'number' ? res.page : 1,
    pageSize,
    hasMore,
    lastDoc: res.lastDoc ?? res.nextCursor ?? undefined,
  };
};

export class ProjectService {

  static async createProject(data: CreateProjectData): Promise<string> {
    const result = await apiClient.post<ProjectResponse>('/v1/projects', {
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
      const result = await apiClient.get<RawProject>(`/v1/projects/${id}`);
      return toDomain(result);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) return null;
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
      const res = await apiClient.get<RawProjectsPage>('/v1/projects');
      return toPaginatedProjects(res, pageSize);
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

  static async getSettings(projectId: string): Promise<ProjectSettingsResponse> {
    return apiClient.get<ProjectSettingsResponse>(`/v1/projects/${projectId}/settings`);
  }

  static async updateSettings(
    projectId: string,
    dto: UpdateProjectSettingsDto,
  ): Promise<ProjectSettingsResponse> {
    return apiClient.patch<ProjectSettingsResponse>(`/v1/projects/${projectId}/settings`, dto);
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
    _lastDoc?: unknown
  ): Promise<PaginatedResponse<Project>> {
    try {
      const res = await apiClient.get<RawProjectsPage>('/v1/projects');
      return toPaginatedProjects(res, pageSize);
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
