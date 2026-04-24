import { apiClient } from '../lib/apiClient';
import type { User, CreateUserData, UpdateUserData } from '../types/domain';

const toDomain = (r: any): User => ({
  id: r.id,
  email: r.email,
  displayName: r.displayName,
  role: r.role ?? 'member',
  avatar: r.avatarUrl ?? undefined,
  createdAt: '',
  updatedAt: '',
});

export class UserService {
  static async createOrUpdateUser(_uid: string, _data: CreateUserData): Promise<void> {
    await apiClient.post('/v1/auth/sync', {});
  }

  static async getUser(_uid: string): Promise<User | null> {
    try {
      const result = await apiClient.get<any>('/v1/users/me');
      return toDomain(result);
    } catch (error: any) {
      if (error?.status === 404) return null;
      console.error('Error getting user:', error);
      return null;
    }
  }

  static async updateUser(_uid: string, _data: UpdateUserData): Promise<void> {
    // Not implemented in new backend yet
  }

  static async searchUsersByEmail(email: string): Promise<User[]> {
    try {
      const res = await apiClient.get<{ items: any[]; nextCursor: string | null }>(
        `/v1/users?search=${encodeURIComponent(email)}`
      );
      return res.items.map(toDomain);
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  static async getUsersByIds(_userIds: string[]): Promise<User[]> {
    try {
      const res = await apiClient.get<{ items: any[]; nextCursor: string | null }>('/v1/users');
      return res.items.map(toDomain);
    } catch (error) {
      console.error('Error getting users by IDs:', error);
      return [];
    }
  }

  static async userExists(_uid: string): Promise<boolean> {
    try {
      await apiClient.get('/v1/users/me');
      return true;
    } catch {
      return false;
    }
  }

  static async getAllUsers(): Promise<User[]> {
    try {
      const res = await apiClient.get<{ items: any[]; nextCursor: string | null }>('/v1/users');
      return res.items.map(toDomain);
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  static async syncAfterLogin(): Promise<User> {
    const result = await apiClient.post<any>('/v1/auth/sync', {});
    return toDomain(result);
  }
}

export default UserService;
