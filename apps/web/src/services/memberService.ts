import { apiClient } from '../lib/apiClient';
import type {
  UserSearchResult,
  MemberSearchFilters,
  MemberManagementPermissions,
  ProjectMember
} from '../types/domain';

export class MemberService {
  static async searchUsers(filters: MemberSearchFilters): Promise<UserSearchResult[]> {
    try {
      const query = filters.query ? `?search=${encodeURIComponent(filters.query)}` : '';
      const res = await apiClient.get<{ items: any[]; nextCursor: string | null }>(`/v1/users${query}`);
      let users: UserSearchResult[] = res.items.map(r => ({
        id: r.id,
        email: r.email,
        displayName: r.displayName,
        role: r.role ?? 'member',
        avatar: r.avatarUrl ?? undefined,
        isAlreadyMember: filters.excludeMembers?.includes(r.id) ?? false,
      }));

      if (filters.excludeMembers?.length) {
        users = users.filter(u => !filters.excludeMembers!.includes(u.id));
      }
      if (filters.roleFilter?.length) {
        users = users.filter(u => filters.roleFilter!.includes(u.role));
      }
      return users.slice(0, filters.limit || 10);
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  static async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    try {
      const rows = await apiClient.get<Array<{ user: any; projectRole: string }>>(`/v1/projects/${projectId}/members`);
      return rows.map(r => ({
        userId: r.user.id,
        email: r.user.email,
        displayName: r.user.displayName,
        role: 'member' as const,
        avatar: r.user.avatarUrl ?? undefined,
        joinedAt: '',
        addedBy: '',
      }));
    } catch (error) {
      console.error('Error getting project members:', error);
      throw error;
    }
  }

  static async addMember(projectId: string, userId: string, _performedBy: string): Promise<void> {
    await apiClient.post(`/v1/projects/${projectId}/members`, { userId, projectRole: 'contributor' });
  }

  static async removeMember(projectId: string, userId: string, _performedBy: string): Promise<void> {
    await apiClient.delete(`/v1/projects/${projectId}/members/${userId}`);
  }

  static async getMemberManagementPermissions(
    _projectId: string,
    _userId: string
  ): Promise<MemberManagementPermissions> {
    return {
      canAddMembers: true,
      canRemoveMembers: true,
      canChangeRoles: false,
      canRemoveAdmin: false,
      canRemovePM: false,
    };
  }

  static async getRecentlyAddedUsers(limitCount: number = 5): Promise<UserSearchResult[]> {
    try {
      const res = await apiClient.get<{ items: any[]; nextCursor: string | null }>('/v1/users');
      return res.items.slice(0, limitCount).map(r => ({
        id: r.id,
        email: r.email,
        displayName: r.displayName,
        role: r.role ?? 'member',
        avatar: r.avatarUrl ?? undefined,
      }));
    } catch (error) {
      console.error('Error getting recently added users:', error);
      throw error;
    }
  }
}
