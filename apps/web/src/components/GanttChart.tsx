import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  Gantt,
  Willow,
  Toolbar,
  defaultToolbarButtons,
} from 'wx-react-gantt';
import type {
  GanttApi,
  GanttColumn,
  GanttScale,
  GanttTask,
  GanttLink,
  GanttId,
  ToolbarItem,
} from 'wx-react-gantt';
import type { Task, TaskLink } from '../types/domain';
import type { WorkingCalendarResponse } from '@project-workgroup/shared';
import {
  GanttDataProvider,
  type GanttDataChangePayload,
  type GanttLinkChangePayload,
} from '../services/ganttDataProvider';
import { taskManager } from '../services/taskManager';
import { calendarService } from '../services/calendarService';
import { createHighlightTime } from '../services/workingCalendarMarkers';
import { LocaleProvider } from './LocaleProvider';
import { setupAutoLocalization } from '../utils/ganttLocalizer';
import { applyBarTooltips } from '../utils/ganttBarTooltips';
import { GanttTimeline } from './GanttTimeline';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';

import coreLocaleEs from 'wx-core-locales/locales/es';
import ganttLocaleEs from '../locales/gantt-es';

interface GanttChartProps {
  tasks?: Task[];
  links?: TaskLink[];
  projectId: string;
  loading?: boolean;
  error?: string | null;
  apiRef?: React.RefObject<GanttApi | null>;
  onAddTask?: () => void;
  onTasksChanged?: (payload: GanttDataChangePayload) => void;
  onLinksChanged?: (payload: GanttLinkChangePayload) => void;
  calendar?: WorkingCalendarResponse | null;
  onSelectTask?: (taskId: string) => void;
}

const GanttChart: React.FC<GanttChartProps> = ({
  tasks,
  links = [],
  projectId,
  loading = false,
  error = null,
  apiRef: externalApiRef,
  onAddTask,
  onTasksChanged,
  onLinksChanged,
  calendar: calendarFromProps,
  onSelectTask,
}) => {
  const internalApiRef = useRef<GanttApi | null>(null);
  const apiRef = externalApiRef ?? internalApiRef;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onSelectTaskRef = useRef<((taskId: string) => void) | undefined>(onSelectTask);
  const dataProviderRef = useRef<GanttDataProvider | null>(null);
  React.useEffect(() => {
    onSelectTaskRef.current = onSelectTask;
  }, [onSelectTask]);
  const [pxPerDay, setPxPerDay] = useState(30);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [toolbarApi, setToolbarApi] = useState<GanttApi | null>(null);
  const [dataProvider, setDataProvider] = useState<GanttDataProvider | null>(null);
  const [ganttData, setGanttData] = useState<{ tasks: GanttTask[]; links: GanttLink[] }>({
    tasks: [],
    links: [],
  });
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [calendarLocal, setCalendarLocal] = useState<WorkingCalendarResponse | null>(null);
  const calendar = calendarFromProps ?? calendarLocal;
  const errorBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localizationCleanupRef = useRef<(() => void) | null>(null);
  const initListenersInstalledRef = useRef(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const cleanup = setupAutoLocalization();
      localizationCleanupRef.current = cleanup;
    }, 500);
    return () => {
      clearTimeout(timeoutId);
      if (localizationCleanupRef.current) {
        localizationCleanupRef.current();
        localizationCleanupRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!projectId) return;

    const provider = new GanttDataProvider(projectId);
    dataProviderRef.current = provider;

    provider.setOnError(({ message }) => {
      setErrorBanner(message);
      if (errorBannerTimeoutRef.current) clearTimeout(errorBannerTimeoutRef.current);
      errorBannerTimeoutRef.current = setTimeout(() => setErrorBanner(null), 4000);
    });

    const handleTaskManagerEvent = async (eventData: { action: string; projectId: string; taskId?: string; task?: Task }) => {
      if (eventData.projectId !== projectId) return;
      if (eventData.action === 'task-created' && eventData.task) {
        onTasksChanged?.({ updated: [eventData.task], deleted: [], refresh: true });
      } else if (eventData.action === 'task-deleted' && eventData.taskId) {
        onTasksChanged?.({ updated: [], deleted: [eventData.taskId], refresh: true });
      }
    };

    taskManager.on(handleTaskManagerEvent);
    setDataProvider(provider);

    return () => {
      taskManager.off(handleTaskManagerEvent);
      provider.setOnError(null);
      provider.destroy();
      if (errorBannerTimeoutRef.current) {
        clearTimeout(errorBannerTimeoutRef.current);
        errorBannerTimeoutRef.current = null;
      }
      initListenersInstalledRef.current = false;
      dataProviderRef.current = null;
      setDataProvider(null);
    };
  }, [projectId, onTasksChanged]);

  useEffect(() => {
    if (!dataProvider) return;
    dataProvider.setOnDataChange(onTasksChanged ? (payload) => onTasksChanged(payload) : null);
    return () => {
      dataProvider.setOnDataChange(null);
    };
  }, [dataProvider, onTasksChanged]);

  useEffect(() => {
    if (!dataProvider) return;
    dataProvider.setOnLinkChange(onLinksChanged ? (payload) => onLinksChanged(payload) : null);
    return () => {
      dataProvider.setOnLinkChange(null);
    };
  }, [dataProvider, onLinksChanged]);

  useEffect(() => {
    if (!dataProvider) return;
    setGanttData(dataProvider.syncFromData(tasks ?? [], links));
  }, [dataProvider, tasks, links]);

  useEffect(() => {
    if (!projectId) return;
    if (calendarFromProps !== undefined) return;
    let cancelled = false;
    calendarService
      .getForProject(projectId)
      .then((cal) => {
        if (!cancelled) setCalendarLocal(cal);
      })
      .catch((e) => console.error('GanttChart: error cargando calendario', e));
    return () => {
      cancelled = true;
    };
  }, [projectId, calendarFromProps]);

  const highlightTime = React.useMemo(() => createHighlightTime(calendar), [calendar]);
  const { isDays } = useProjectSettings();

  const { scales, cellWidth, zoomLevel, zoomLabel } = React.useMemo(() => {
    const allTiers = [
      { level: 0, label: 'Año',         max: 0.5,      factor: 365,    scales: [{ unit: 'year', step: 1, format: 'yyyy' }] },
      { level: 1, label: 'Año / Trim.', max: 2,        factor: 91,     scales: [{ unit: 'year', step: 1, format: 'yyyy' }, { unit: 'quarter', step: 1, format: "'T'Q" }] },
      { level: 2, label: 'Trim. / Mes', max: 8,        factor: 30,     scales: [{ unit: 'quarter', step: 1, format: "'T'Q yyyy" }, { unit: 'month', step: 1, format: 'MMM' }] },
      { level: 3, label: 'Mes / Sem.',  max: 25,       factor: 7,      scales: [{ unit: 'month', step: 1, format: 'MMM yyyy' }, { unit: 'week', step: 1, format: "'sem' w" }] },
      { level: 4, label: 'Mes / Día',   max: 100,      factor: 1,      scales: [{ unit: 'month', step: 1, format: 'MMM yyyy' }, { unit: 'day', step: 1, format: 'd' }] },
      { level: 5, label: 'Día / 6h',    max: 400,      factor: 0.25,   scales: [{ unit: 'day', step: 1, format: 'EEE d MMM' }, { unit: 'hour', step: 6, format: 'HH:mm' }] },
      { level: 6, label: 'Día / Hora',  max: Infinity, factor: 1 / 24, scales: [{ unit: 'day', step: 1, format: 'EEE d MMM' }, { unit: 'hour', step: 1, format: 'HH:mm' }] },
    ] as const;
    const tiers = isDays ? allTiers.filter((t) => t.level <= 4) : allTiers;
    const tier = tiers.find((t) => pxPerDay <= t.max) ?? tiers[tiers.length - 1];
    return {
      scales: tier.scales as unknown as GanttScale[],
      cellWidth: Math.max(8, Math.round(pxPerDay * tier.factor)),
      zoomLevel: tier.level,
      zoomLabel: tier.label,
    };
  }, [pxPerDay, isDays]);

  const locale = React.useMemo(() => ({ ...coreLocaleEs, ...ganttLocaleEs }), []);

  const markers = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [{ start: today, text: 'Hoy', css: 'current-day-marker' }];
  }, []);

  const columns: GanttColumn[] = React.useMemo(() => {
    const STATUS_LABEL: Record<string, string> = {
      'not-started': 'No iniciada',
      'in-progress': 'En curso',
      completed: 'Completada',
      blocked: 'Bloqueada',
    };

    return [
      { id: 'text', header: 'Nombre', flexGrow: 2 },
      {
        id: 'status',
        header: 'Estado',
        align: 'center',
        flexGrow: 1,
        template: (_v: unknown, task: GanttTask & { status?: string }) => {
          return STATUS_LABEL[task.status ?? ''] ?? '—';
        },
      },
      {
        id: 'estimatedHours',
        header: 'Esfuerzo',
        align: 'center',
        flexGrow: 1,
        template: (_v: unknown, task: GanttTask) => {
          if (task.type === 'milestone') return '—';
          const hours = Number(task.estimatedHours ?? 0);
          if (!Number.isFinite(hours) || hours <= 0) return '—';
          return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
        },
      },
      {
        id: 'duration',
        header: 'Duración',
        align: 'center',
        flexGrow: 1,
        template: (_v: unknown, task: GanttTask) => {
          if (task.type === 'milestone') return '—';
          const labDays = Number(task.duration ?? 0);
          const labText = !Number.isFinite(labDays) || labDays <= 0
            ? '0'
            : Number.isInteger(labDays) ? `${labDays}` : labDays.toFixed(1);
          const start = task.start instanceof Date ? task.start : null;
          const end = task.end instanceof Date ? task.end : null;
          if (!start || !end) return `${labText}d lab`;
          const natDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
          return `${labText}d lab / ${natDays}d nat`;
        },
      },
      {
        id: 'progress',
        header: 'Progreso',
        align: 'center',
        flexGrow: 1,
        template: (_v: unknown, task: GanttTask) => {
          const value = Math.max(0, Math.min(100, Math.round(Number(task.progress) || 0)));
          return `${value}%`;
        },
      },
      {
        id: 'action',
        header: 'Acciones',
        align: 'center',
        width: 50,
        template: (_v: unknown, task: GanttTask) => {
          const taskId = String(task.id)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;');
          return `
            <div class="task-actions">
              <button class="add-child-btn" type="button" data-task-id="${taskId}" title="Agregar subtarea">+</button>
            </div>
          `;
        },
      },
    ];
  }, []);

  const handleAddTaskFromToolbar = async () => {
    try {
      await taskManager.createTask({
        projectId,
        name: 'Nueva Tarea',
        description: 'Tarea creada desde el toolbar',
        priority: 'medium',
        estimatedHours: 40,
      });
    } catch (e) {
      console.error('GanttChart: error creando tarea desde toolbar', e);
    }
  };

  const toolbarItems: ToolbarItem[] = React.useMemo(
    () =>
      defaultToolbarButtons
        .filter((button) => button.id !== 'edit-task' && button.id !== 'delete-task')
        .map((button) =>
          button.id === 'add-task' ? { ...button, handler: handleAddTaskFromToolbar } : button,
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId],
  );

  const addChildTask = useCallback(
    async (parentId: number | string) => {
      if (!dataProvider) return;
      const parentTaskId = dataProvider.getTaskIdFromGanttId(parentId);
      if (!parentTaskId) {
        console.error('GanttChart: no se encontró el ID de la tarea padre', parentId);
        return;
      }
      try {
        await taskManager.createSubtask(parentTaskId, {
          projectId,
          name: 'Nueva Subtarea',
          description: 'Subtarea creada desde el Gantt',
          priority: 'medium',
          type: 'task',
          estimatedHours: 8,
          skipEvent: false,
        });
      } catch (e) {
        console.error('GanttChart: error creando subtarea', e);
      }
    },
    [dataProvider, projectId],
  );

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>('.add-child-btn');
      if (!target) return;
      const id = target.dataset.taskId;
      if (id != null) void addChildTask(id);
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [addChildTask]);

  useEffect(() => {
    const MIN_PX = 0.05;
    const MAX_PX = 2400;
    const SENSITIVITY = 0.0035;

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as Element | null;
      if (!target?.closest('.gantt-container .wx-chart')) return;

      e.stopPropagation();
      e.preventDefault();

      const factor = Math.exp(-e.deltaY * SENSITIVITY);
      setPxPerDay((prev) => {
        const next = prev * factor;
        return Math.max(MIN_PX, Math.min(MAX_PX, next));
      });
    };

    document.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => document.removeEventListener('wheel', onWheel, true);
  }, []);

  const initGantt = useCallback(
    (api: GanttApi) => {
      if (!api) return;

      if (apiRef.current) {
        Object.assign(apiRef.current, api);
      } else {
        Object.defineProperty(apiRef, 'current', { value: api, writable: true, configurable: true });
      }
      setToolbarApi(api);

      try {
        if (typeof api.setLocale === 'function') api.setLocale(locale);
        else if (api.config) api.config.locale = locale;
      } catch (e) {
        console.warn('GanttChart: no se pudo configurar la localización', e);
      }

      if (initListenersInstalledRef.current) return;
      initListenersInstalledRef.current = true;

      if (dataProvider) {
        if (typeof api.setNext === 'function') api.setNext(dataProvider);
        dataProvider.setGanttApi(api);
      }

      api.on('scroll-chart', (ev: { left?: number; top?: number }) => {
        setScrollLeft(ev.left ?? 0);
      });
      api.on('select-task', (ev: { id?: GanttId }) => {
        if (ev.id === undefined || ev.id === null) return;
        const realId = dataProvider?.getTaskIdFromGanttId?.(ev.id) ?? String(ev.id);
        if (realId) onSelectTaskRef.current?.(realId);
      });
      if (dataProvider) {
        api.on('open-task', ({ id, _fromRestore }) => {
          if (_fromRestore) return;
          dataProvider.handleExpandCollapseState({ id, isOpen: true });
        });
        api.on('close-task', ({ id, _fromRestore }) => {
          if (_fromRestore) return;
          dataProvider.handleExpandCollapseState({ id, isOpen: false });
        });
      }
    },
    [apiRef, dataProvider, locale],
  );

  useEffect(() => {
    if (!apiRef.current || !dataProvider) return;
    const t = setTimeout(() => {
      if (apiRef.current) initGantt(apiRef.current);
    }, 50);
    return () => clearTimeout(t);
  }, [apiRef, dataProvider, initGantt]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const THROTTLE_MS = 200;
    let scheduled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const apply = () => {
      scheduled = false;
      applyBarTooltips(apiRef.current, container);
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      timeoutId = setTimeout(apply, THROTTLE_MS);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    const barsArea = container.querySelector('.wx-bars');
    if (barsArea) {
      observer.observe(barsArea, { childList: true, subtree: false });
    }

    return () => {
      scheduled = false;
      if (timeoutId !== null) clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [apiRef, ganttData.tasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: 'var(--surface)' }}>
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-6 w-6 mx-auto"
            style={{ border: '2px solid var(--p-500)', borderTopColor: 'transparent' }}
          />
          <p
            style={{
              font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
              color: 'var(--ink-3)',
              margin: 'var(--s-3) 0 0',
            }}
          >
            Cargando...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: 'var(--surface)' }}>
        <div className="text-center max-w-md p-6">
          <div
            className="mx-auto mb-3 flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
              borderRadius: '999px',
              background: 'var(--err-bg)',
              color: 'var(--err-fg)',
            }}
          >
            <span style={{ fontSize: 20 }}>⚠</span>
          </div>
          <p
            style={{
              font: '500 var(--t-small)/1.3 var(--font-sans)',
              color: 'var(--err-fg)',
              margin: '0 0 4px',
            }}
          >
            Error al cargar
          </p>
          <p style={{ font: '400 var(--t-small)/var(--lh-small) var(--font-sans)', color: 'var(--ink-2)', margin: 0 }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!loading && ganttData.tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: 'var(--surface)' }}>
        <div className="text-center max-w-md p-6">
          <div
            className="mx-auto mb-4 flex items-center justify-center"
            style={{
              width: 64,
              height: 64,
              borderRadius: '999px',
              background: 'var(--p-50)',
              color: 'var(--p-600)',
            }}
          >
            <span style={{ fontSize: 24 }}>📋</span>
          </div>
          <h3
            style={{
              font: '500 var(--t-h3)/var(--lh-h3) var(--font-sans)',
              color: 'var(--ink)',
              margin: '0 0 var(--s-2)',
            }}
          >
            No hay tareas en este proyecto
          </h3>
          <p
            style={{
              font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
              color: 'var(--ink-2)',
              margin: '0 0 var(--s-4)',
            }}
          >
            Comienza agregando tu primera tarea para ver el diagrama de Gantt.
          </p>
          <button className="btn btn-primary" onClick={onAddTask}>
            Agregar primera tarea
          </button>
        </div>
      </div>
    );
  }

  return (
    <LocaleProvider>
      <div ref={containerRef} className="h-full gantt-container relative flex flex-col">
        {errorBanner && (
          <div
            className="absolute top-2 right-2 z-50"
            style={{
              background: 'var(--err-bg)',
              border: '1px solid var(--err-line)',
              color: 'var(--err-fg)',
              padding: 'var(--s-2) var(--s-3)',
              borderRadius: 'var(--r-md)',
              boxShadow: 'var(--sh-2)',
              font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
            }}
          >
            {errorBanner}
          </div>
        )}
        <div className="flex-1 min-h-0 relative">
          <Willow>
            <Toolbar api={toolbarApi} items={toolbarItems} />
            <Gantt
              init={initGantt}
              tasks={ganttData.tasks}
              links={ganttData.links}
              scales={scales}
              columns={columns}
              markers={markers}
              cellWidth={cellWidth}
              highlightTime={highlightTime}
              {...({ lengthUnit: 'hour' } as { lengthUnit: 'hour' })}
            />
          </Willow>
        </div>
        <GanttTimeline
          scrollLeft={scrollLeft}
          api={apiRef.current}
          tasks={ganttData.tasks}
          zoomLevel={zoomLevel}
          zoomLabel={zoomLabel}
        />
      </div>
    </LocaleProvider>
  );
};

export default GanttChart;
