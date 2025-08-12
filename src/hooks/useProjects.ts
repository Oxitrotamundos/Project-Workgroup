import { useState, useEffect, useCallback } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';
import { ProjectService } from '../services/projectService';
import { UserService } from '../services/userService';
import type {
  Project,
  CreateProjectData,
  UpdateProjectData,
  ProjectFilters,
  User
} from '../types/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useUserRole } from './useUserRole';

interface UseProjectsState {
  projects: Project[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
}

interface UseProjectsActions {
  createProject: (data: CreateProjectData) => Promise<string>;
  updateProject: (id: string, data: UpdateProjectData) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  addMember: (projectId: string, userId: string) => Promise<void>;
  removeMember: (projectId: string, userId: string) => Promise<void>;
}

interface UseProjectsReturn extends UseProjectsState, UseProjectsActions { }

/**
 * Hook personalizado para gestionar proyectos
 */
export function useProjects(filters?: ProjectFilters, pageSize: number = 10): UseProjectsReturn {
  const { user } = useAuth();
  const { userRole } = useUserRole();
  const [state, setState] = useState<UseProjectsState>({
    projects: [],
    loading: true,
    error: null,
    hasMore: false
  });
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | undefined>();

  // Cargar proyectos
  const loadProjects = useCallback(async (reset: boolean = false) => {
    if (!user || !userRole) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: null,
        projects: [],
        hasMore: false
      }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      let response;
      
      // Los administradores pueden ver todos los proyectos
      if (userRole === 'admin') {
        response = await ProjectService.getAllProjects(
          filters,
          pageSize,
          reset ? undefined : lastDoc
        );
      } else {
        // PM y miembros solo ven sus proyectos
        response = await ProjectService.getUserProjects(
          user.uid,
          filters,
          pageSize
        );
      }

      setState(prev => ({
        ...prev,
        projects: reset ? response.items : [...prev.projects, ...response.items],
        hasMore: response.hasMore,
        loading: false,
        error: null
      }));

      // Actualizar lastDoc para paginación
      if (response.lastDoc) {
        setLastDoc(response.lastDoc);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar proyectos';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        projects: [],
        hasMore: false
      }));
    }
  }, [user, userRole, filters, pageSize, lastDoc]);

  // Refrescar lista de proyectos
  const refresh = useCallback(async (): Promise<void> => {
    setLastDoc(undefined);
    await loadProjects(true);
  }, [loadProjects]);

  // Crear proyecto
  const createProject = useCallback(async (data: CreateProjectData): Promise<string> => {
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    try {
      // Asegurar que el usuario actual esté en la lista de miembros
      const projectData = {
        ...data,
        ownerId: user.uid,
        members: data.members.includes(user.uid) ? data.members : [...data.members, user.uid]
      };

      const projectId = await ProjectService.createProject(projectData);

      // Refrescar la lista de proyectos para mostrar el nuevo proyecto
      await refresh();

      return projectId;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }, [user, refresh]);

  // Actualizar proyecto
  const updateProject = useCallback(async (id: string, data: UpdateProjectData): Promise<void> => {
    try {
      await ProjectService.updateProject(id, data);

      // Refrescar la lista de proyectos para mostrar los cambios actualizados
      await refresh();
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }, [refresh]);

  // Eliminar proyecto
  const deleteProject = useCallback(async (id: string): Promise<void> => {
    try {
      await ProjectService.deleteProject(id);

      // Refrescar la lista de proyectos para reflejar la eliminación
      await refresh();
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }, [refresh]);

  // Cargar más proyectos (paginación)
  const loadMore = useCallback(async (): Promise<void> => {
    if (state.loading || !state.hasMore) {
      return;
    }

    await loadProjects(false);
  }, [state.loading, state.hasMore, loadProjects]);

  // Agregar miembro
  const addMember = useCallback(async (projectId: string, userId: string): Promise<void> => {
    try {
      await ProjectService.addMember(projectId, userId);

      // Actualizar el proyecto en el estado local
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(project => {
          if (project.id === projectId && !project.members.includes(userId)) {
            return {
              ...project,
              members: [...project.members, userId]
            };
          }
          return project;
        })
      }));
    } catch (error) {
      console.error('Error adding member:', error);
      throw error;
    }
  }, []);

  // Remover miembro
  const removeMember = useCallback(async (projectId: string, userId: string): Promise<void> => {
    try {
      await ProjectService.removeMember(projectId, userId);

      // Actualizar el proyecto en el estado local
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(project => {
          if (project.id === projectId) {
            return {
              ...project,
              members: project.members.filter(id => id !== userId)
            };
          }
          return project;
        })
      }));
    } catch (error) {
      console.error('Error removing member:', error);
      throw error;
    }
  }, []);

  // Cargar proyectos al montar el componente o cambiar filtros
  useEffect(() => {
    if (userRole) {
      loadProjects(true);
    }
  }, [user, userRole, filters, loadProjects]);

  return {
    // Estado
    projects: state.projects,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,

    // Acciones
    createProject,
    updateProject,
    deleteProject,
    loadMore,
    refresh,
    addMember,
    removeMember
  };
}

/**
 * Hook para obtener un proyecto específico
 */
export function useProject(projectId: string | null) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<User[]>([]);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }

    const loadProject = async () => {
      try {
        setLoading(true);
        setError(null);

        const projectData = await ProjectService.getProject(projectId);
        setProject(projectData);

        // Cargar información de los miembros
        if (projectData && projectData.members.length > 0) {
          const membersData = await UserService.getUsersByIds(projectData.members);
          setMembers(membersData);
        }
      } catch (err) {
        console.error('Error loading project:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar el proyecto');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  return {
    project,
    members,
    loading,
    error
  };
}

export default useProjects;