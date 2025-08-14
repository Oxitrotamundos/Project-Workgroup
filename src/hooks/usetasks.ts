import { useState, useEffect, useCallback } from 'react';
import { TaskService } from '../services/taskservice';
import type {
  Task,
  CreateTaskData,
  UpdateTaskData,
  TaskFilters
} from '../types/firestore';
import { useAuth } from '../contexts/AuthContext';

interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  createTask: (data: CreateTaskData) => Promise<void>;
  updateTask: (id: string, data: UpdateTaskData) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateTaskProgress: (id: string, progress: number) => Promise<void>;
  addTaskDependency: (taskId: string, dependencyId: string) => Promise<void>;
  removeTaskDependency: (taskId: string, dependencyId: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
  refetch: () => Promise<void>;
}

export const useTasks = (projectId?: string, filters?: TaskFilters): UseTasksReturn => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let loadedTasks: Task[];

      if (projectId) {
        // Cargar tareas de un proyecto específico
        loadedTasks = await TaskService.getProjectTasks(projectId, filters);
      } else {
        // Cargar tareas del usuario
        loadedTasks = await TaskService.getUserTasks(user.uid, filters);
      }

      setTasks(loadedTasks);
    } catch (err) {
      console.error('Error loading tasks:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar las tareas');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [user, projectId, filters]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const createTask = useCallback(async (data: CreateTaskData) => {
    try {
      setError(null);
      await TaskService.createTask(data);
      await loadTasks(); // Recargar tareas después de crear
    } catch (err) {
      console.error('Error creating task:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al crear la tarea';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [loadTasks]);

  const updateTask = useCallback(async (id: string, data: UpdateTaskData) => {
    try {
      setError(null);
      await TaskService.updateTask(id, data);
      await loadTasks(); // Recargar tareas después de actualizar
    } catch (err) {
      console.error('Error updating task:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar la tarea';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [loadTasks]);

  const deleteTask = useCallback(async (id: string) => {
    try {
      setError(null);
      await TaskService.deleteTask(id);
      await loadTasks(); // Recargar tareas después de eliminar
    } catch (err) {
      console.error('Error deleting task:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar la tarea';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [loadTasks]);

  const updateTaskProgress = useCallback(async (id: string, progress: number) => {
    try {
      setError(null);
      await TaskService.updateTaskProgress(id, progress);
      await loadTasks(); // Recargar tareas después de actualizar progreso
    } catch (err) {
      console.error('Error updating task progress:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar el progreso';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [loadTasks]);

  const addTaskDependency = useCallback(async (taskId: string, dependencyId: string) => {
    try {
      setError(null);
      await TaskService.addTaskDependency(taskId, dependencyId);
      await loadTasks(); // Recargar tareas después de agregar dependencia
    } catch (err) {
      console.error('Error adding task dependency:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al agregar dependencia';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [loadTasks]);

  const removeTaskDependency = useCallback(async (taskId: string, dependencyId: string) => {
    try {
      setError(null);
      await TaskService.removeTaskDependency(taskId, dependencyId);
      await loadTasks(); // Recargar tareas después de remover dependencia
    } catch (err) {
      console.error('Error removing task dependency:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al remover dependencia';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [loadTasks]);

  const refreshTasks = useCallback(async () => {
    await loadTasks();
  }, [loadTasks]);

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    updateTaskProgress,
    addTaskDependency,
    removeTaskDependency,
    refreshTasks,
    refetch: refreshTasks
  };
};

export default useTasks;