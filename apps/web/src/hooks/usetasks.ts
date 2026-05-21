import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Task, CreateTaskData, TaskFilters } from '../types/domain';
import type { UpdateTaskDto } from '@project-workgroup/shared';
import { useAuth } from '../contexts/AuthContext';
import {
  useDeleteTaskMutation,
  useProjectTasksQuery,
  useUpdateTaskMutation,
  useUpdateTaskProgressMutation,
} from './queries/useTaskQueries';
import { taskKeys } from './queries/taskQueryKeys';

interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  createTask: (data: CreateTaskData) => Promise<string>;
  updateTask: (id: string, data: UpdateTaskDto) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateTaskProgress: (id: string, progress: number) => Promise<void>;
  addTaskDependency: (taskId: string, dependencyId: string) => Promise<void>;
  removeTaskDependency: (taskId: string, dependencyId: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
  refetch: () => Promise<void>;
}

export const useTasks = (projectId?: string, filters?: TaskFilters): UseTasksReturn => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useProjectTasksQuery(user ? projectId : undefined, filters);
  const updateMutation = useUpdateTaskMutation(projectId);
  const progressMutation = useUpdateTaskProgressMutation(projectId);
  const deleteMutation = useDeleteTaskMutation(projectId);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
  }, [queryClient, projectId]);

  const createTask = useCallback(async (data: CreateTaskData): Promise<string> => {
    const { taskManager } = await import('../services/taskManager');
    const taskId = await taskManager.createTask({
      projectId: data.projectId,
      name: data.name,
      description: data.description,
      assigneeId: data.assigneeId,
      parentId: data.parentId,
      priority: data.priority,
      estimatedHours: data.estimatedHours,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      duration: data.duration,
    });
    await queryClient.invalidateQueries({ queryKey: taskKeys.byProject(data.projectId) });
    return taskId;
  }, [queryClient]);

  const updateTask = useCallback(async (id: string, data: UpdateTaskDto) => {
    await updateMutation.mutateAsync({ id, data });
  }, [updateMutation]);

  const deleteTask = useCallback(async (id: string) => {
    await deleteMutation.mutateAsync(id);
  }, [deleteMutation]);

  const updateTaskProgress = useCallback(async (id: string, progress: number) => {
    await progressMutation.mutateAsync({ id, progress });
  }, [progressMutation]);

  const addTaskDependency = useCallback(async () => {
    throw new Error('addTaskDependency: pendiente de migración a TaskLinkService');
  }, []);

  const removeTaskDependency = useCallback(async () => {
    throw new Error('removeTaskDependency: pendiente de migración a TaskLinkService');
  }, []);

  return {
    tasks: query.data ?? [],
    loading: query.isLoading && !query.data,
    error: query.error instanceof Error ? query.error.message : null,
    createTask,
    updateTask,
    deleteTask,
    updateTaskProgress,
    addTaskDependency,
    removeTaskDependency,
    refreshTasks: refresh,
    refetch: refresh,
  };
};

export default useTasks;
