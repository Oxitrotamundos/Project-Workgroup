import { useState, useEffect, useCallback } from 'react';
import { MemberService } from '../services/memberService';
import { useAuth } from '../contexts/AuthContext';
import type {
  ProjectMember,
  UserSearchResult,
  MemberSearchFilters,
  MemberManagementPermissions
} from '../types/firestore';

interface UseMembersState {
  members: ProjectMember[];
  searchResults: UserSearchResult[];
  permissions: MemberManagementPermissions | null;
  loading: boolean;
  searchLoading: boolean;
  error: string | null;
}

interface UseMembersActions {
  loadMembers: () => Promise<void>;
  searchUsers: (filters: MemberSearchFilters) => Promise<void>;
  addMember: (userId: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  clearSearch: () => void;
  refreshPermissions: () => Promise<void>;
}

interface UseMembersReturn extends UseMembersState, UseMembersActions {}

export function useMembers(projectId: string | null): UseMembersReturn {
  const { user } = useAuth();
  const [state, setState] = useState<UseMembersState>({
    members: [],
    searchResults: [],
    permissions: null,
    loading: false,
    searchLoading: false,
    error: null
  });

  // Cargar miembros del proyecto
  const loadMembers = useCallback(async (): Promise<void> => {
    if (!projectId) {
      setState(prev => ({ ...prev, members: [], error: null }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const members = await MemberService.getProjectMembers(projectId);
      setState(prev => ({
        ...prev,
        members,
        loading: false
      }));
    } catch (error) {
      console.error('Error loading members:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Error al cargar miembros'
      }));
    }
  }, [projectId]);

  // Buscar usuarios
  const searchUsers = useCallback(async (filters: MemberSearchFilters): Promise<void> => {
    setState(prev => ({ ...prev, searchLoading: true, error: null }));

    try {
      // Excluir miembros actuales de la búsqueda
      const excludeMembers = (state.members || []).map(member => member.userId);
      const searchFilters = {
        ...filters,
        excludeMembers: [...(filters.excludeMembers || []), ...excludeMembers],
        limit: filters.limit || 3 // Máximo 3 sugerencias
      };

      const results = await MemberService.searchUsers(searchFilters);
      setState(prev => ({
        ...prev,
        searchResults: results,
        searchLoading: false
      }));
    } catch (error) {
      console.error('Error searching users:', error);
      setState(prev => ({
        ...prev,
        searchLoading: false,
        error: error instanceof Error ? error.message : 'Error al buscar usuarios'
      }));
    }
  }, [state.members]);

  // Agregar miembro
  const addMember = useCallback(async (userId: string): Promise<void> => {
    if (!projectId || !user) {
      throw new Error('Proyecto o usuario no disponible');
    }

    try {
      await MemberService.addMember(projectId, userId, user.uid);
      
      // Recargar miembros después de agregar
      await loadMembers();
      
      // Limpiar resultados de búsqueda
      setState(prev => ({ ...prev, searchResults: [] }));
    } catch (error) {
      console.error('Error adding member:', error);
      throw error;
    }
  }, [projectId, user, loadMembers]);

  // Quitar miembro
  const removeMember = useCallback(async (userId: string): Promise<void> => {
    if (!projectId || !user) {
      throw new Error('Proyecto o usuario no disponible');
    }

    try {
      await MemberService.removeMember(projectId, userId, user.uid);
      
      // Recargar miembros después de quitar
      await loadMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      throw error;
    }
  }, [projectId, user, loadMembers]);

  // Limpiar resultados de búsqueda
  const clearSearch = useCallback((): void => {
    setState(prev => ({ ...prev, searchResults: [] }));
  }, []);

  // Refrescar permisos
  const refreshPermissions = useCallback(async (): Promise<void> => {
    if (!projectId || !user) {
      setState(prev => ({ ...prev, permissions: null }));
      return;
    }

    try {
      const permissions = await MemberService.getMemberManagementPermissions(projectId, user.uid);
      setState(prev => ({ ...prev, permissions }));
    } catch (error) {
      console.error('Error loading permissions:', error);
      setState(prev => ({
        ...prev,
        permissions: {
          canAddMembers: false,
          canRemoveMembers: false,
          canChangeRoles: false,
          canRemoveAdmin: false,
          canRemovePM: false
        }
      }));
    }
  }, [projectId, user]);

  // Cargar datos iniciales
  useEffect(() => {
    if (projectId && user) {
      loadMembers();
      refreshPermissions();
    }
  }, [projectId, user, loadMembers, refreshPermissions]);

  return {
    ...state,
    loadMembers,
    searchUsers,
    addMember,
    removeMember,
    clearSearch,
    refreshPermissions
  };
}

export default useMembers;