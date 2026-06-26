import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Task, TaskFilters } from '../../types/domain';
import type { UpdateTaskDto } from '@project-workgroup/shared';
import { TaskService, type BulkUpdateItem, type BulkUpdateResult } from '../../services/taskService';
import { TaskLinkService } from '../../services/taskLinkService';
import { taskKeys } from './taskQueryKeys';
import type { TaskLink } from '../../types/domain';
import { applySummaryPatches } from '../../lib/summaryPatches';

const replaceOrInsertTask = (prev: Task[] | undefined, fresh: Task): Task[] => {
  if (!prev) return [fresh];
  const idx = prev.findIndex((t) => t.id === fresh.id);
  if (idx === -1) return [...prev, fresh];
  const next = prev.slice();
  next[idx] = fresh;
  return next;
};

export function useProjectTasksQuery(projectId: string | undefined, filters?: TaskFilters) {
  return useQuery({
    queryKey: taskKeys.byProject(projectId),
    queryFn: () => {
      if (!projectId) return Promise.resolve([] as Task[]);
      return TaskService.getProjectTasks(projectId, filters);
    },
    enabled: Boolean(projectId),
  });
}

export function useProjectTaskLinksQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.linksByProject(projectId),
    queryFn: () => {
      if (!projectId) return Promise.resolve([] as TaskLink[]);
      return TaskLinkService.getProjectLinks(projectId);
    },
    enabled: Boolean(projectId),
  });
}

export function useUpdateTaskMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = taskKeys.byProject(projectId);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskDto }) => TaskService.updateTask(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Task[]>(queryKey);
      queryClient.setQueryData<Task[]>(queryKey, (prev) => {
        if (!prev) return prev;
        return prev.map((t) =>
          t.id === id
            ? {
                ...t,
                ...(data.name !== undefined && { name: data.name }),
                ...(data.description !== undefined && { description: data.description ?? undefined }),
                ...(data.startDate !== undefined && { startDate: data.startDate }),
                ...(data.endDate !== undefined && { endDate: data.endDate }),
                ...(data.priority !== undefined && { priority: data.priority }),
                ...(data.status !== undefined && { status: data.status }),
                ...(data.type !== undefined && { type: data.type }),
                ...(data.color !== undefined && { color: data.color }),
                ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
                ...(data.parentId !== undefined && { parentId: data.parentId ?? undefined }),
              }
            : t,
        );
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData<Task[]>(queryKey, (prev) => replaceOrInsertTask(prev, fresh));
    },
  });
}

export function useUpdateTaskProgressMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = taskKeys.byProject(projectId);

  return useMutation({
    mutationFn: ({ id, progress, expectedVersion }: { id: string; progress: number; expectedVersion?: number }) =>
      TaskService.updateTaskProgress(id, progress, expectedVersion),
    onSuccess: (fresh) => {
      queryClient.setQueryData<Task[]>(queryKey, (prev) => replaceOrInsertTask(prev, fresh));
    },
  });
}

export function useDeleteTaskMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = taskKeys.byProject(projectId);

  return useMutation({
    mutationFn: (id: string) => TaskService.deleteTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Task[]>(queryKey);
      queryClient.setQueryData<Task[]>(queryKey, (prev) => prev?.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
  });
}

export function useBulkUpdateTasksMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = taskKeys.byProject(projectId);

  return useMutation({
    mutationFn: (updates: BulkUpdateItem[]): Promise<BulkUpdateResult> => {
      if (!projectId) throw new Error('projectId is required for bulk update');
      return TaskService.bulkUpdate(projectId, updates);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<Task[]>(queryKey, (prev) => {
        const patched = applySummaryPatches(prev, result.summariesPatched);
        return result.tasks.reduce<Task[] | undefined>(
          (acc, task) => replaceOrInsertTask(acc, task),
          patched,
        );
      });
    },
  });
}
