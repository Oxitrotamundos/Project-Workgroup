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
  ToolbarItem,
} from 'wx-react-gantt';
import type { Task } from '../types/domain';
import { GanttDataProvider } from '../services/ganttDataProvider';
import { taskManager } from '../services/taskManager';
import { LocaleProvider } from './LocaleProvider';
import { setupAutoLocalization } from '../utils/ganttLocalizer';
import { GanttTimeline } from './GanttTimeline';

import coreLocaleEs from 'wx-core-locales/locales/es';
import ganttLocaleEs from '../locales/gantt-es';

declare global {
  interface Window {
    wx?: any;
    wxLocale?: string;
    wxLocales?: any;
    addChildTask?: (parentId: number | string) => void;
  }
}

const setupGlobalLocalization = () => {
  if (typeof window === 'undefined') return;
  window.wx = window.wx || {};
  window.wx.locales = window.wx.locales || {};
  window.wx.locales['es'] = { ...coreLocaleEs, ...ganttLocaleEs };
  window.wx.locale = 'es';
  if (window.wx.i18n) window.wx.i18n.setLocale('es');
  window.wxLocale = 'es';
  window.wxLocales = window.wx.locales;
};

interface GanttChartProps {
  tasks?: Task[];
  projectId: string;
  loading?: boolean;
  error?: string | null;
  apiRef?: React.RefObject<GanttApi | null>;
  onAddTask?: () => void;
}

const GanttChart: React.FC<GanttChartProps> = ({
  projectId,
  loading = false,
  error = null,
  apiRef: externalApiRef,
  onAddTask,
}) => {
  const internalApiRef = useRef<GanttApi | null>(null);
  const apiRef = externalApiRef ?? internalApiRef;
  const [pxPerDay, setPxPerDay] = useState(30);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [toolbarApi, setToolbarApi] = useState<GanttApi | null>(null);
  const [dataProvider, setDataProvider] = useState<GanttDataProvider | null>(null);
  const [ganttData, setGanttData] = useState<{ tasks: GanttTask[]; links: GanttLink[] }>({
    tasks: [],
    links: [],
  });
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const errorBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localizationCleanupRef = useRef<(() => void) | null>(null);
  const initListenersInstalledRef = useRef(false);

  const loadGanttData = useCallback(async (provider: GanttDataProvider) => {
    const data = await provider.getData();
    setGanttData(data);
  }, []);

  useEffect(() => {
    setupGlobalLocalization();
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
    if (!projectId || dataProvider) return;

    const provider = new GanttDataProvider(projectId);

    provider.setOnError(({ message }) => {
      setErrorBanner(message);
      if (errorBannerTimeoutRef.current) clearTimeout(errorBannerTimeoutRef.current);
      errorBannerTimeoutRef.current = setTimeout(() => setErrorBanner(null), 4000);
    });

    const handleTaskManagerEvent = async (eventData: { action: string; projectId: string }) => {
      if (eventData.projectId !== projectId) return;
      if (eventData.action === 'task-created' || eventData.action === 'task-deleted') {
        try {
          await loadGanttData(provider);
        } catch (e) {
          console.error('GanttChart: error recargando datos tras evento externo', e);
        }
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!dataProvider) return;
    loadGanttData(dataProvider).catch((e) =>
      console.error('GanttChart: error cargando datos iniciales', e),
    );
  }, [dataProvider, loadGanttData]);

  const { scales, cellWidth, zoomLevel, zoomLabel } = React.useMemo(() => {
    const tiers = [
      { level: 0, label: 'Año',         max: 0.5,      factor: 365,    scales: [{ unit: 'year', step: 1, format: 'yyyy' }] },
      { level: 1, label: 'Año / Trim.', max: 2,        factor: 91,     scales: [{ unit: 'year', step: 1, format: 'yyyy' }, { unit: 'quarter', step: 1, format: "'T'Q" }] },
      { level: 2, label: 'Trim. / Mes', max: 8,        factor: 30,     scales: [{ unit: 'quarter', step: 1, format: "'T'Q yyyy" }, { unit: 'month', step: 1, format: 'MMM' }] },
      { level: 3, label: 'Mes / Sem.',  max: 25,       factor: 7,      scales: [{ unit: 'month', step: 1, format: 'MMM yyyy' }, { unit: 'week', step: 1, format: "'sem' w" }] },
      { level: 4, label: 'Mes / Día',   max: 100,      factor: 1,      scales: [{ unit: 'month', step: 1, format: 'MMM yyyy' }, { unit: 'day', step: 1, format: 'd' }] },
      { level: 5, label: 'Día / 6h',    max: 400,      factor: 0.25,   scales: [{ unit: 'day', step: 1, format: 'EEE d MMM' }, { unit: 'hour', step: 6, format: 'HH:mm' }] },
      { level: 6, label: 'Día / Hora',  max: Infinity, factor: 1 / 24, scales: [{ unit: 'day', step: 1, format: 'EEE d MMM' }, { unit: 'hour', step: 1, format: 'HH:mm' }] },
    ] as const;
    const tier = tiers.find((t) => pxPerDay <= t.max) ?? tiers[tiers.length - 1];
    return {
      scales: tier.scales as unknown as GanttScale[],
      cellWidth: Math.max(8, Math.round(pxPerDay * tier.factor)),
      zoomLevel: tier.level,
      zoomLabel: tier.label,
    };
  }, [pxPerDay]);

  const locale = React.useMemo(() => ({ ...coreLocaleEs, ...ganttLocaleEs }), []);

  const markers = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [{ start: today, text: 'Hoy', css: 'current-day-marker' }];
  }, []);

  const columns: GanttColumn[] = React.useMemo(
    () => [
      { id: 'text', header: 'Nombre de la tarea', flexGrow: 2 },
      { id: 'start', header: 'Fecha de inicio', align: 'center', flexGrow: 1 },
      { id: 'duration', header: 'Duración', align: 'center', flexGrow: 1 },
      { id: 'progress', header: 'Progreso', align: 'center', flexGrow: 1 },
      {
        id: 'action',
        header: 'Acciones',
        align: 'center',
        width: 50,
        template: (task: GanttTask) => `
          <div class="task-actions">
            <button
              class="add-child-btn"
              onclick="window.addChildTask('${String(task.id).replace(/'/g, "\\'")}')"
              title="Agregar subtarea"
            >
              +
            </button>
          </div>
        `,
      },
    ],
    [],
  );

  const dayDiff = (next: Date, prev: Date): number => {
    const d = (next.getTime() - prev.getTime()) / 1000 / 60 / 60 / 24;
    return Math.ceil(Math.abs(d));
  };

  const collectProgressFromKids = useCallback(
    (id: number | string): [number, number] => {
      let totalProgress = 0;
      let totalDuration = 0;
      const api = apiRef.current;
      if (!api) return [0, 0];
      const task = api.getTask(id);
      if (!task) return [0, 0];
      const kids = task.data ?? [];
      kids.forEach((kid: GanttTask) => {
        if (kid.type !== 'milestone' && kid.type !== 'summary') {
          const duration = kid.duration || dayDiff(kid.end, kid.start);
          totalDuration += duration;
          totalProgress += duration * (kid.progress ?? 0);
        }
        const [p, d] = collectProgressFromKids(kid.id);
        totalProgress += p;
        totalDuration += d;
      });
      return [totalProgress, totalDuration];
    },
    [apiRef],
  );

  const recalcSummaryProgress = useCallback(
    (id: number | string, self = false) => {
      const api = apiRef.current;
      if (!api) return;
      const state = api.getState();
      const tasksLib = state?.tasks as unknown as { getSummaryId?: (id: number | string) => number | string };
      const task = api.getTask(id);
      if (!task || task.type === 'milestone') return;
      const summary =
        self && task.type === 'summary'
          ? id
          : tasksLib && typeof tasksLib.getSummaryId === 'function'
          ? tasksLib.getSummaryId(id)
          : undefined;
      if (!summary) return;
      const summaryTask = api.getTask(summary);
      const [totalProgress, totalDuration] = collectProgressFromKids(summary);
      const progress = totalDuration === 0 ? 0 : Math.round(totalProgress / totalDuration);
      const current = Math.round(Number(summaryTask?.progress ?? 0));
      if (current === progress) return;
      api.exec('update-task', { id: summary, task: { progress }, _silent: true });
    },
    [apiRef, collectProgressFromKids],
  );

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
    window.addChildTask = addChildTask;
    return () => {
      delete window.addChildTask;
    };
  }, [addChildTask]);

  useEffect(() => {
    const MIN_PX = 0.05;
    const MAX_PX = 2400;
    const SENSITIVITY = 0.0035; // ajuste por unidad de deltaY (multiplicativo)

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

      if (dataProvider) {
        if (typeof api.setNext === 'function') api.setNext(dataProvider);
        dataProvider.setGanttApi(api);
      }

      if (initListenersInstalledRef.current) return;
      initListenersInstalledRef.current = true;

      api.on('update-task', ({ id }) => recalcSummaryProgress(id));
      api.on('delete-task', ({ source }) => {
        if (source !== undefined) recalcSummaryProgress(source, true);
      });
      api.on('copy-task', ({ id }) => recalcSummaryProgress(id));
      api.on('move-task', ({ id, source, inProgress }) => {
        if (inProgress) return;
        const movedTask = api.getTask(id);
        if (movedTask && source !== undefined && movedTask.parent !== source) {
          recalcSummaryProgress(source, true);
        }
        recalcSummaryProgress(id);
      });
      api.on('scroll-chart', (ev: { left?: number; top?: number }) => {
        setScrollLeft(ev.left ?? 0);
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
    [apiRef, dataProvider, locale, recalcSummaryProgress],
  );

  useEffect(() => {
    if (!apiRef.current || !dataProvider) return;
    const t = setTimeout(() => {
      if (apiRef.current) initGantt(apiRef.current);
    }, 50);
    return () => clearTimeout(t);
  }, [apiRef, dataProvider, initGantt]);

  useEffect(() => {
    if (!dataProvider) return;
    const interval = setInterval(() => {
      const api = apiRef.current;
      if (!api) return;
      dataProvider.reconcileExpansionStates(api).catch((e) =>
        console.error('GanttChart: reconcileExpansionStates falló', e),
      );
    }, 10_000);
    return () => clearInterval(interval);
  }, [apiRef, dataProvider]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-3 text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-red-500 text-xl">⚠</span>
          </div>
          <p className="text-red-600 font-medium mb-1">Error al cargar</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!loading && ganttData.tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-blue-500 text-2xl">📋</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay tareas en este proyecto</h3>
          <p className="text-gray-500 text-sm mb-4">
            Comienza agregando tu primera tarea para ver el diagrama de Gantt.
          </p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            onClick={onAddTask}
          >
            Agregar primera tarea
          </button>
        </div>
      </div>
    );
  }

  return (
    <LocaleProvider>
      <div className="h-full gantt-container relative flex flex-col">
        {errorBanner && (
          <div className="absolute top-2 right-2 z-50 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded shadow text-sm">
            {errorBanner}
          </div>
        )}
        <div className="flex-1 min-h-0">
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
