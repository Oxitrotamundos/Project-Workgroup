import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ProjectService } from '../services/projectService';
import type { Project, UpdateProjectData } from '../types/firestore';

interface UseProjectReturn {
  project: Project | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateProject: (updates: UpdateProjectData) => Promise<void>;
}

export const useProject = (projectId: string | undefined): UseProjectReturn => {
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    if (!projectId || !user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Verificar acceso al proyecto
      const hasAccess = await ProjectService.hasAccess(projectId, user.uid);
      if (!hasAccess) {
        setError('No tienes acceso a este proyecto');
        return;
      }

      // Cargar datos del proyecto
      const projectData = await ProjectService.getProject(projectId);
      if (!projectData) {
        setError('Proyecto no encontrado');
        return;
      }

      setProject(projectData);
    } catch (err) {
      console.error('Error loading project:', err);
      setError('Error al cargar el proyecto');
    } finally {
      setLoading(false);
    }
  }, [projectId, user]);

  const updateProject = useCallback(async (updates: UpdateProjectData) => {
    if (!projectId || !project) {
      throw new Error('No hay proyecto para actualizar');
    }

    try {
      await ProjectService.updateProject(projectId, updates);
      setProject(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      console.error('Error updating project:', err);
      throw new Error('Error al actualizar el proyecto');
    }
  }, [projectId, project]);

  const refetch = useCallback(async () => {
    await loadProject();
  }, [loadProject]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  return {
    project,
    loading,
    error,
    refetch,
    updateProject
  };
};

export default useProject;