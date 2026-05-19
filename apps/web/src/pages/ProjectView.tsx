import React, { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import 'wx-react-gantt/dist/gantt.css';
import '../styles/gantt-custom.css';
import { useTasks } from '../hooks/usetasks';
import { useProject } from '../hooks/useProject';
import { useMembers } from '../hooks/useMembers';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { ProjectActions, ProjectMeta } from '../components/Layout';
import TasksView from '../components/TasksView/TasksView';
import type { NewTaskInput } from '../components/TasksView/NewTaskRow';
import { ProjectStateManager } from '../components/ProjectLoadingStates';
import { taskManager } from '../services/taskManager';
import { TaskService } from '../services/taskService';
import type { GanttDataChangePayload } from '../services/ganttDataProvider';
import { taskKeys } from '../hooks/queries/taskQueryKeys';
import type { Task, TaskPriority, TaskStatus } from '../types/domain';

const ProjectView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const ganttApiRef = useRef<any>(null);
  const { user } = useAuth();
  const { updateNavigation } = useNavigation();
  const queryClient = useQueryClient();

  const { project, loading, error, refetch } = useProject(projectId);
  const { tasks, loading: tasksLoading, error: tasksError, refetch: refetchTasks } = useTasks(projectId);
  const { members, loadMembers } = useMembers(projectId ?? null);

  const applyTasksPayload = React.useCallback(
    (payload: GanttDataChangePayload) => {
      if (!projectId) return;
      const queryKey = taskKeys.byProject(projectId);
      queryClient.setQueryData<Task[]>(queryKey, (prev) => {
        if (!prev && payload.updated.length === 0) return prev;
        let next = prev ? prev.slice() : [];
        for (const fresh of payload.updated) {
          const idx = next.findIndex((t) => t.id === fresh.id);
          if (idx === -1) next.push(fresh);
          else next[idx] = fresh;
        }
        if (payload.deleted.length > 0) {
          const deletedSet = new Set(payload.deleted);
          next = next.filter((t) => !deletedSet.has(t.id));
        }
        return next;
      });
    },
    [projectId, queryClient],
  );

  React.useEffect(() => {
    if (projectId) {
      loadMembers();
    }
  }, [projectId, loadMembers]);

  const handleOpenCalendar = React.useCallback(() => {
    if (projectId) navigate(`/project/${projectId}/settings/calendar`);
  }, [projectId, navigate]);

  const tasksCount = tasks.length;

  const projectActions = React.useMemo(() => {
    if (!project) return undefined;
    return (
      <div className="flex items-center gap-3">
        <ProjectMeta project={project} tasksCount={tasksCount} />
        <span
          aria-hidden="true"
          className="hidden md:block"
          style={{ width: 1, height: 18, background: 'var(--line-2)' }}
        />
        <ProjectActions onOpenCalendar={handleOpenCalendar} />
      </div>
    );
  }, [project, tasksCount, handleOpenCalendar]);

  const crumbs = React.useMemo(
    () =>
      project
        ? [
            { label: 'Proyectos', to: '/dashboard' },
            { label: project.name },
          ]
        : undefined,
    [project?.name],
  );

  React.useEffect(() => {
    if (!project) return;
    updateNavigation({
      title: project.name,
      subtitle: project.description || undefined,
      crumbs,
      actions: projectActions,
    });
  }, [project?.name, project?.description, crumbs, projectActions, updateNavigation]);

  const handleAddTask = async () => {
    if (!projectId || !user) return;
    const taskId = await taskManager.createTask({
      projectId,
      name: 'Nueva Tarea Principal',
      description: 'Descripción de la nueva tarea',
      priority: 'medium',
      type: 'task',
      estimatedHours: 8,
    });
    const fresh = await TaskService.getTask(taskId);
    if (fresh) applyTasksPayload({ updated: [fresh], deleted: [] });
  };

  const handleCreateTaskInline = React.useCallback(
    async (input: NewTaskInput) => {
      if (!projectId) throw new Error('Proyecto no encontrado');
      const taskId = await taskManager.createTask({
        projectId,
        name: input.name,
        description: '',
        priority: input.priority,
        status: input.status,
        type: input.type,
        estimatedHours: input.estimatedHours,
        startDate: input.startDate ? new Date(`${input.startDate}T00:00:00Z`) : undefined,
        assigneeId: input.assigneeId,
        skipEvent: true,
      });
      const fresh = await TaskService.getTask(taskId);
      if (fresh) applyTasksPayload({ updated: [fresh], deleted: [] });
    },
    [projectId, applyTasksPayload],
  );

  const assigneeOptions = React.useMemo(
    () => members.map((m) => ({ id: m.userId, displayName: m.displayName, avatar: m.avatar })),
    [members],
  );

  const handleUpdateTaskInline = React.useCallback(
    async (
      taskId: string,
      patch: {
        status?: TaskStatus;
        priority?: TaskPriority;
        estimatedHours?: number;
        progress?: number;
        startDate?: string;
        endDate?: string;
      },
      expectedVersion?: number,
    ) => {
      const hasGeneralPatch =
        patch.status !== undefined ||
        patch.priority !== undefined ||
        patch.estimatedHours !== undefined ||
        patch.startDate !== undefined ||
        patch.endDate !== undefined;
      let latest: Task | undefined;
      try {
        if (hasGeneralPatch) {
          latest = await TaskService.updateTask(taskId, {
            ...(patch.status !== undefined && { status: patch.status }),
            ...(patch.priority !== undefined && { priority: patch.priority }),
            ...(patch.estimatedHours !== undefined && { estimatedHours: String(patch.estimatedHours) }),
            ...(patch.startDate !== undefined && { startDate: patch.startDate }),
            ...(patch.endDate !== undefined && { endDate: patch.endDate }),
            ...(expectedVersion !== undefined && { expectedVersion }),
          });
        }
        if (patch.progress !== undefined) {
          latest = await TaskService.updateTaskProgress(
            taskId,
            patch.progress,
            hasGeneralPatch ? undefined : expectedVersion,
          );
        }
        if (latest) applyTasksPayload({ updated: [latest], deleted: [] });
      } catch (e) {
        await refetchTasks();
        throw e;
      }
    },
    [applyTasksPayload, refetchTasks],
  );

  return (
    <ProjectStateManager
      loading={loading}
      error={error}
      project={project}
      onRetry={refetch}
    >
      <div className="flex-1 p-4 sm:p-6">
        <div
          className="h-[calc(100vh-130px)] overflow-hidden"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-xl)',
            boxShadow: 'var(--sh-1)',
          }}
        >
          <TasksView
            tasks={tasks}
            projectId={projectId || ''}
            loading={tasksLoading}
            error={tasksError}
            apiRef={ganttApiRef}
            onAddTask={handleAddTask}
            onCreateTask={handleCreateTaskInline}
            onUpdateTask={handleUpdateTaskInline}
            onTasksChanged={applyTasksPayload}
            assignees={assigneeOptions}
          />
        </div>
      </div>
    </ProjectStateManager>
  );
};

export default ProjectView;
