export const taskKeys = {
  all: ['tasks'] as const,
  byProject: (projectId: string | undefined) => ['tasks', 'project', projectId ?? '_'] as const,
  linksByProject: (projectId: string | undefined) => ['task-links', 'project', projectId ?? '_'] as const,
  byUser: (userId: string | undefined) => ['tasks', 'user', userId ?? '_'] as const,
  detail: (taskId: string) => ['tasks', 'detail', taskId] as const,
};
