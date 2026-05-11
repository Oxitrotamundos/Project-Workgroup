import { useState, useCallback } from 'react';
import type { Task, TaskPriority, TaskStatus } from '../../types/domain';
import type { GanttDataChangePayload } from '../../services/ganttDataProvider';
import GanttChart from '../GanttChart';
import TaskListView from './TaskListView';
import TasksFooter from './TasksFooter';
import { useTaskStats } from './useTaskStats';
import type { NewTaskInput, AssigneeOption } from './NewTaskRow';
import './tasksView.css';

export type TasksViewMode = 'gantt' | 'list';

const STORAGE_KEY = 'pwg.tasksView.mode';

interface Props {
  tasks: Task[];
  projectId: string;
  loading?: boolean;
  error?: string | null;
  apiRef?: React.MutableRefObject<any>;
  onAddTask?: () => void;
  onCreateTask?: (input: NewTaskInput) => Promise<void>;
  onUpdateTask?: (
    taskId: string,
    patch: { status?: TaskStatus; priority?: TaskPriority; estimatedHours?: number; progress?: number },
    expectedVersion?: number,
  ) => Promise<void>;
  onTasksChanged?: (payload: GanttDataChangePayload) => void;
  assignees?: AssigneeOption[];
  initialMode?: TasksViewMode;
}

const TasksView: React.FC<Props> = ({
  tasks,
  projectId,
  loading,
  error,
  apiRef,
  onAddTask,
  onCreateTask,
  onUpdateTask,
  onTasksChanged,
  assignees,
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
              projectId={projectId}
              loading={loading}
              error={error}
              apiRef={apiRef}
              onAddTask={onAddTask}
              onTasksChanged={onTasksChanged}
            />
          </div>
        ) : (
          <TaskListView tasks={tasks} onCreate={onCreateTask} onUpdate={onUpdateTask} assignees={assignees} />
        )}
      </div>

      <TasksFooter stats={stats} />
    </section>
  );
};

export default TasksView;
