import { useState, useEffect, useCallback } from 'react';
import { TaskService } from '../services/taskService';
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
  createTask: (data: CreateTaskData) => Promise<string>;
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
    console.log('useTasks: Iniciando loadTasks...');
    console.log('useTasks: Usuario:', user ? 'autenticado' : 'no autenticado');
    console.log('useTasks: ProjectId:', projectId);
    
    if (!user) {
      console.log('useTasks: No hay usuario, limpiando tareas');
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
        console.log('useTasks: Cargando tareas del proyecto:', projectId);
        loadedTasks = await TaskService.getProjectTasks(projectId, filters);
      } else {
        // Cargar tareas del usuario
        console.log('useTasks: Cargando tareas del usuario:', user.uid);
        loadedTasks = await TaskService.getUserTasks(user.uid, filters);
      }
      
      console.log('useTasks: Tareas cargadas:', loadedTasks.length);

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

  const createTask = useCallback(async (data: CreateTaskData): Promise<string> => {
    console.log('useTasks: Usando TaskManager para crear tarea:', data);
    try {
      setError(null);
      
      // Usar TaskManager en lugar de TaskService directamente
      const { taskManager } = await import('../services/taskManager');
      const taskId = await taskManager.createTask({
        projectId: data.projectId,
        name: data.name,
        description: data.description,
        assigneeId: data.assigneeId,
        parentId: data.parentId,
        priority: data.priority,
        estimatedHours: data.estimatedHours,
        startDate: data.startDate,
        endDate: data.endDate,
        duration: data.duration
      });
      
      console.log('useTasks: Tarea creada con ID:', taskId);
      await loadTasks(); // Recargar tareas después de crear
      console.log('useTasks: Tareas recargadas');
      return taskId;
    } catch (err) {
      console.error('useTasks: Error creating task:', err);
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