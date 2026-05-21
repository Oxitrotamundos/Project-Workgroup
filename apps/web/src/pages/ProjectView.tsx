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
import type { GanttDataChangePayload, GanttLinkChangePayload } from '../services/ganttDataProvider';
import { taskKeys } from '../hooks/queries/taskQueryKeys';
import { useProjectTaskLinksQuery } from '../hooks/queries/useTaskQueries';
import { useProjectSettingsQuery } from '../hooks/queries/useProjectSettings';
import { ProjectSettingsProvider } from '../contexts/ProjectSettingsContext';
import { applySummaryPatches } from '../lib/summaryPatches';
import { calendarService } from '../services/calendarService';
import type { WorkingCalendarResponse } from '@project-workgroup/shared';
import type { Task, TaskLink, TaskPriority, TaskStatus, TaskType } from '../types/domain';

const ProjectView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const ganttApiRef = useRef<any>(null);
  const { user } = useAuth();
  const { updateNavigation } = useNavigation();
  const queryClient = useQueryClient();

  const { project, loading, error, refetch } = useProject(projectId);
  const { tasks, loading: tasksLoading, error: tasksError, refetch: refetchTasks } = useTasks(projectId);
  const { data: taskLinks = [] } = useProjectTaskLinksQuery(user ? projectId : undefined);
  const { data: projectSettings } = useProjectSettingsQuery(user ? projectId : undefined);
  const { members, loadMembers } = useMembers(projectId ?? null);
  const [calendar, setCalendar] = React.useState<WorkingCalendarResponse | null>(null);

  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    calendarService
      .getForProject(projectId)
      .then((cal) => {
        if (!cancelled) setCalendar(cal);
      })
      .catch((e) => console.error('ProjectView: error cargando calendario', e));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

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
        next = applySummaryPatches(next, payload.summariesPatched) ?? next;
        if (payload.deleted.length > 0) {
          const deletedSet = new Set(payload.deleted);
          next = next.filter((t) => !deletedSet.has(t.id));
        }
        return next;
      });
      if (payload.refresh) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
    [projectId, queryClient],
  );

  const applyLinksPayload = React.useCallback(
    (payload: GanttLinkChangePayload) => {
      if (!projectId) return;
      queryClient.setQueryData<TaskLink[]>(taskKeys.linksByProject(projectId), (prev) => {
        if (!prev && payload.updated.length === 0) return prev;
        let next = prev ? prev.slice() : [];
        for (const fresh of payload.updated) {
          const idx = next.findIndex((link) => link.id === fresh.id);
          if (idx === -1) next.push(fresh);
          else next[idx] = fresh;
        }
        if (payload.deleted.length > 0) {
          const deleted = new Set(payload.deleted);
          next = next.filter((link) => !deleted.has(link.id));
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
    if (projectId) navigate(`/project/${projectId}/settings`);
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
        <ProjectActions onOpenCalendar={handleOpenCalendar} calendar={calendar} />
      </div>
    );
  }, [project, tasksCount, handleOpenCalendar, calendar]);

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
        name?: string;
        description?: string;
        status?: TaskStatus;
        priority?: TaskPriority;
        type?: TaskType;
        estimatedHours?: number;
        progress?: number;
        startDate?: string;
        endDate?: string;
      },
      expectedVersion?: number,
    ) => {
      try {
        const result = await TaskService.updateTaskWithMeta(taskId, {
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.description !== undefined && { description: patch.description }),
          ...(patch.status !== undefined && { status: patch.status }),
          ...(patch.priority !== undefined && { priority: patch.priority }),
          ...(patch.type !== undefined && { type: patch.type }),
          ...(patch.estimatedHours !== undefined && { estimatedHours: String(patch.estimatedHours) }),
          ...(patch.startDate !== undefined && { startDate: patch.startDate }),
          ...(patch.endDate !== undefined && { endDate: patch.endDate }),
          ...(patch.progress !== undefined && { progress: patch.progress }),
          ...(expectedVersion !== undefined && { expectedVersion }),
        });
        applyTasksPayload({
          updated: [result.task],
          deleted: [],
          summariesPatched: result.summariesPatched,
        });
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
      <ProjectSettingsProvider settings={projectSettings ?? null}>
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
              links={taskLinks}
              projectId={projectId || ''}
              loading={tasksLoading}
              error={tasksError}
              apiRef={ganttApiRef}
              onAddTask={handleAddTask}
              onCreateTask={handleCreateTaskInline}
              onUpdateTask={handleUpdateTaskInline}
              onTasksChanged={applyTasksPayload}
              onLinksChanged={applyLinksPayload}
              assignees={assigneeOptions}
              calendar={calendar}
            />
          </div>
        </div>
      </ProjectSettingsProvider>
    </ProjectStateManager>
  );
};

export default ProjectView;
