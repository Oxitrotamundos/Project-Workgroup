import { useMemo, useState, useCallback } from 'react';
import type { Task, TaskLink, TaskPriority, TaskStatus } from '../../types/domain';
import type { GanttDataChangePayload, GanttLinkChangePayload } from '../../services/ganttDataProvider';
import type { GanttApi } from 'wx-react-gantt';
import type { WorkingCalendarResponse } from '@project-workgroup/shared';
import GanttChart from '../GanttChart';
import TaskListView from './TaskListView';
import TasksFooter from './TasksFooter';
import TaskSidebar from '../TaskSidebar/TaskSidebar';
import { useTaskStats } from './useTaskStats';
import type { NewTaskInput, AssigneeOption } from './NewTaskRow';
import './tasksView.css';

export type TasksViewMode = 'gantt' | 'list';

const STORAGE_KEY = 'pwg.tasksView.mode';

interface Props {
  tasks: Task[];
  links?: TaskLink[];
  projectId: string;
  loading?: boolean;
  error?: string | null;
  apiRef?: React.RefObject<GanttApi | null>;
  onAddTask?: () => void;
  onCreateTask?: (input: NewTaskInput) => Promise<void>;
  onUpdateTask?: (
    taskId: string,
    patch: {
      name?: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      estimatedHours?: number;
      progress?: number;
      startDate?: string;
      endDate?: string;
      assigneeId?: string | null;
    },
    expectedVersion?: number,
  ) => Promise<void>;
  onTasksChanged?: (payload: GanttDataChangePayload) => void;
  onLinksChanged?: (payload: GanttLinkChangePayload) => void;
  assignees?: AssigneeOption[];
  calendar?: WorkingCalendarResponse | null;
  initialMode?: TasksViewMode;
}

const TasksView: React.FC<Props> = ({
  tasks,
  links,
  projectId,
  loading,
  error,
  apiRef,
  onAddTask,
  onCreateTask,
  onUpdateTask,
  onTasksChanged,
  onLinksChanged,
  assignees,
  calendar,
  initialMode,
}) => {
  const [mode, setModeState] = useState<TasksViewMode>(() => {
    if (initialMode) return initialMode;
    if (typeof window === 'undefined') return 'gantt';
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === 'list' ? 'list' : 'gantt';
  });

  const setMode = useCallback((m: TasksViewMode) => {
    setModeState(m);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, m);
  }, []);

  const stats = useTaskStats(tasks);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = useMemo(
    () => (selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null),
    [selectedTaskId, tasks],
  );
  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
  }, []);
  const handleCloseSidebar = useCallback(() => setSelectedTaskId(null), []);

  return (
    <section className="tv tv-frame" aria-label="Tareas del proyecto">
      <header className="tv-header">
        <div className="tv-title-row">
          <h1 className="tv-title">
            Tareas
            <span className="tv-title-num">N.º {String(tasks.length).padStart(3, '0')}</span>
          </h1>

          <div className="tv-segmented" role="tablist" aria-label="Modo de visualización">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'gantt'}
              className="tv-seg-btn"
              data-active={mode === 'gantt'}
              onClick={() => setMode('gantt')}
            >
              Gantt
            </button>
            <span className="tv-seg-divider" aria-hidden="true" />
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'list'}
              className="tv-seg-btn"
              data-active={mode === 'list'}
              onClick={() => setMode('list')}
            >
              Lista
            </button>
          </div>
        </div>
      </header>

      <div className="tv-body">
        {mode === 'gantt' ? (
          <div className="tv-gantt-frame">
            <GanttChart
              tasks={tasks}
              links={links}
              projectId={projectId}
              loading={loading}
              error={error}
              apiRef={apiRef}
              onAddTask={onAddTask}
              onTasksChanged={onTasksChanged}
              onLinksChanged={onLinksChanged}
              calendar={calendar}
              onSelectTask={handleSelectTask}
              assignees={assignees}
            />
          </div>
        ) : (
          <TaskListView
            tasks={tasks}
            onCreate={onCreateTask}
            onUpdate={onUpdateTask}
            onSelectTask={handleSelectTask}
            assignees={assignees}
          />
        )}
      </div>

      <TasksFooter stats={stats} />
      <TaskSidebar
        task={selectedTask}
        open={selectedTask !== null}
        onClose={handleCloseSidebar}
        assignees={assignees}
        onSave={async (taskId, patch, expectedVersion) => {
          if (onUpdateTask) await onUpdateTask(taskId, patch, expectedVersion);
        }}
      />
    </section>
  );
};

export default TasksView;
