import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Gantt, Willow, Toolbar, defaultToolbarButtons } from 'wx-react-gantt';
import type { Task } from '../types/domain';
import { GanttDataProvider } from '../services/ganttDataProvider';
import { taskManager } from '../services/taskManager';
import { LocaleProvider } from './LocaleProvider';
import { setupAutoLocalization } from '../utils/ganttLocalizer';

import coreLocaleEs from 'wx-core-locales/locales/es';
import ganttLocaleEs from '../locales/gantt-es';

declare global {
  interface Window {
    wx?: any;
    wxLocale?: string;
    wxLocales?: any;
  }
}

const setupGlobalLocalization = () => {
  if (typeof window !== 'undefined') {
    window.wx = window.wx || {};
    window.wx.locales = window.wx.locales || {};
    window.wx.locales['es'] = {
      ...coreLocaleEs,
      ...ganttLocaleEs
    };

    window.wx.locale = 'es';

    if (window.wx.i18n) {
      window.wx.i18n.setLocale('es');
    }

    window.wxLocale = 'es';
    window.wxLocales = window.wx.locales;

    console.log('Localización global configurada:', {
      locale: window.wx.locale,
      hasLocales: !!window.wx.locales,
      esLocale: !!window.wx.locales['es']
    });
  }
};

interface GanttScale {
  unit: 'day' | 'week' | 'month' | 'year';
  step: number;
  format: string;
  css?: string;
}

interface GanttColumn {
  id: string;
  header: string;
  flexGrow?: number;
  align?: 'left' | 'center' | 'right';
}

interface GanttChartProps {
  tasks: Task[];
  projectId: string;
  loading?: boolean;
  error?: string | null;
  apiRef?: React.RefObject<any>;
  onAddTask?: () => void;
}

const GanttChart: React.FC<GanttChartProps> = ({
  tasks,
  projectId,
  loading = false,
  error = null,
  apiRef: externalApiRef,
  onAddTask
}) => {
  const internalApiRef = useRef<any>(null);
  const apiRef = externalApiRef || internalApiRef;
  const [dataProvider, setDataProvider] = useState<GanttDataProvider | null>(null);
  const [ganttData, setGanttData] = useState<{ tasks: any[], links: any[] }>({ tasks: [], links: [] });
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const errorBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const taskStateRef = useRef<Map<number | string, boolean>>(new Map());
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localizationCleanupRef = useRef<(() => void) | null>(null);
  const listenersInstalledRef = useRef(false);

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
    if (projectId && !dataProvider) {
      console.log('Inicializando GanttDataProvider para proyecto:', projectId);
      const provider = new GanttDataProvider(projectId);

      provider.setOnError(({ message }) => {
        setErrorBanner(message);
        if (errorBannerTimeoutRef.current) clearTimeout(errorBannerTimeoutRef.current);
        errorBannerTimeoutRef.current = setTimeout(() => setErrorBanner(null), 4000);
      });

      provider.on('data-updated', async (eventData: any) => {
        console.log('Evento de actualización recibido:', eventData);

        if (eventData.reload || eventData.action === 'add-task' || eventData.action === 'delete-task') {
          console.log('Recargando datos para operación:', eventData.action);
          try {
            const data = await provider.getData();
            setGanttData(data);
          } catch (error) {
            console.error('Error recargando datos:', error);
          }
        } else if (eventData.action === 'sync-error') {
          console.warn('Error de sincronización detectado, recargando datos para consistencia');
          try {
            const data = await provider.getData();
            setGanttData(data);
          } catch (error) {
            console.error('Error recargando datos después de error de sync:', error);
          }
        } else {
          console.log('Operación no requiere recarga:', eventData.action);
        }
      });

      const handleTaskManagerEvent = async (eventData: any) => {
        console.log('GanttChart: Evento de TaskManager recibido:', eventData);

        if (eventData.projectId === projectId && eventData.action === 'task-created') {
          console.log('GanttChart: Tarea creada externamente, recargando datos del Gantt');
          try {
            const data = await provider.getData();
            setGanttData(data);
          } catch (error) {
            console.error('Error recargando datos desde TaskManager:', error);
          }
        }
      };

      taskManager.on(handleTaskManagerEvent);

      setDataProvider(provider);

      return () => {
        taskManager.off(handleTaskManagerEvent);
        provider.setOnError(null);
        if (errorBannerTimeoutRef.current) {
          clearTimeout(errorBannerTimeoutRef.current);
          errorBannerTimeoutRef.current = null;
        }
        listenersInstalledRef.current = false;

        if (mutationObserverRef.current) {
          mutationObserverRef.current.disconnect();
          mutationObserverRef.current = null;
        }

        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        if (localizationCleanupRef.current) {
          localizationCleanupRef.current();
          localizationCleanupRef.current = null;
        }
      };
    }

    return () => {
      if (dataProvider) {
        dataProvider.destroy();
      }
      listenersInstalledRef.current = false;

      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
        mutationObserverRef.current = null;
      }

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      if (localizationCleanupRef.current) {
        localizationCleanupRef.current();
        localizationCleanupRef.current = null;
      }
    };
  }, [projectId]);

  useEffect(() => {
    if (dataProvider) {
      const loadData = async () => {
        try {
          console.log('Cargando datos iniciales...');
          const data = await dataProvider.getData();
          setGanttData(data);
        } catch (error) {
          console.error('Error cargando datos iniciales:', error);
        }
      };

      loadData();
    }
  }, [dataProvider]);

  useEffect(() => {
    if (dataProvider && tasks.length > 0) {
      const loadData = async () => {
        try {
          console.log('Recargando datos del Gantt debido a cambios en tasks prop...');
          const data = await dataProvider.getData();
          setGanttData(data);
        } catch (error) {
          console.error('Error recargando datos del Gantt:', error);
        }
      };

      loadData();
    }
  }, [tasks, dataProvider]);

  const scales: GanttScale[] = React.useMemo(() => [
    { unit: 'month', step: 1, format: 'MMMM yyyy' },
    { unit: 'week', step: 1, format: 'w' },
    { unit: 'day', step: 1, format: 'd' }
  ], []);

  const locale = React.useMemo(() => {
    return {
      ...coreLocaleEs,
      ...ganttLocaleEs
    };
  }, []);

  const markers = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return [
      {
        start: today,
        text: "Hoy",
        css: "current-day-marker"
      }
    ];
  }, []);

  const columns: GanttColumn[] = React.useMemo(() => [
    { id: 'text', header: 'Nombre de la tarea', flexGrow: 2 },
    { id: 'start', header: 'Fecha de inicio', align: 'center', flexGrow: 1 },
    { id: 'duration', header: 'Duración', align: 'center', flexGrow: 1 },
    { id: 'progress', header: 'Progreso', align: 'center', flexGrow: 1 },
    {
      id: 'action',
      header: 'Acciones',
      align: 'center',
      width: 50,
      template: (task: any) => {
        return `
          <div class="task-actions">
            <button
              class="add-child-btn"
              onclick="window.addChildTask('${String(task.id).replace(/'/g, "\\'")}')"
              title="Agregar subtarea"
            >
              +
            </button>
          </div>
        `;
      }
    }
  ], [dataProvider]);

  const dayDiff = (next: Date, prev: Date): number => {
    const d = (next.getTime() - prev.getTime()) / 1000 / 60 / 60 / 24;
    return Math.ceil(Math.abs(d));
  };

  const getSummaryProgress = (id: number): number => {
    const [totalProgress, totalDuration] = collectProgressFromKids(id);
    const res = totalProgress / totalDuration;
    return isNaN(res) ? 0 : Math.round(res);
  };

  const collectProgressFromKids = (id: number): [number, number] => {
    let totalProgress = 0;
    let totalDuration = 0;

    if (!apiRef.current) return [0, 0];

    const task = apiRef.current.getTask(id);
    if (!task) return [0, 0];

    const kids = task.data;

    kids?.forEach((kid: any) => {
      let duration = 0;
      if (kid.type !== 'milestone' && kid.type !== 'summary') {
        duration = kid.duration || dayDiff(kid.end, kid.start);
        totalDuration += duration;
        totalProgress += duration * kid.progress;
      }

      const [p, d] = collectProgressFromKids(kid.id);
      totalProgress += p;
      totalDuration += d;
    });

    return [totalProgress, totalDuration];
  };

  const recalcSummaryProgress = (id: number, self: boolean = false) => {
    if (!apiRef.current) return;

    const state = apiRef.current.getState();
    const tasks = state?.tasks;
    const task = apiRef.current.getTask(id);

    if (task && task.type !== 'milestone' && tasks && typeof tasks.getSummaryId === 'function') {
      const summary = self && task.type === 'summary' ? id : tasks.getSummaryId(id);

      if (summary) {
        const summaryTask = apiRef.current.getTask(summary);
        const progress = getSummaryProgress(summary);
        const current = Math.round(summaryTask?.progress ?? 0);
        if (current === progress) return;
        apiRef.current.exec('update-task', {
          id: summary,
          task: { progress }
        });
      }
    }
  };

  const setupCollapseDetection = useCallback((api: any, provider: GanttDataProvider | null) => {
    if (!provider || mutationObserverRef.current) return;

    const initializeTaskStates = () => {
      const tasks = api.getState()?.tasks;
      if (tasks && Array.isArray(tasks)) {
        tasks.forEach((task: any) => {
          if (task.data && task.data.length > 0) {
            const isOpen = !task.$collapsed;
            taskStateRef.current.set(task.id, isOpen);
          }
        });
      }
    };

    initializeTaskStates();
    setTimeout(initializeTaskStates, 200);

    const observer = new MutationObserver((mutations) => {
      let shouldDetectChanges = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' &&
          (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {

          const element = mutation.target as HTMLElement;

          if (element.classList &&
            (element.classList.contains('wx-gantt-tree-cell') ||
              element.classList.contains('wx-gantt-task') ||
              element.classList.contains('wx-gantt-row') ||
              element.querySelector('.wx-gantt-tree-cell'))) {

            shouldDetectChanges = true;
          }
        }

        if (mutation.type === 'childList') {
          const element = mutation.target as HTMLElement;
          if (element.classList &&
            (element.classList.contains('wx-gantt') ||
              element.closest('.wx-gantt'))) {
            shouldDetectChanges = true;
          }
        }
      });

      if (shouldDetectChanges) {
        setTimeout(() => {
          detectCollapseChanges(api, provider);
        }, 10);
      }
    });

    const ganttContainer = document.querySelector('.wx-gantt');
    if (ganttContainer) {
      observer.observe(ganttContainer, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['class', 'style']
      });
      mutationObserverRef.current = observer;
    }
  }, []);

  const detectCollapseChanges = useCallback(async (api: any, provider: GanttDataProvider | null) => {
    if (!api || !provider) {
      return;
    }

    try {
      let taskArray: any[] = [];
      const state = api.getState();
      if (state?._tasks && Array.isArray(state._tasks)) {
        taskArray = state._tasks;
      }

      if (taskArray.length === 0) {
        if (typeof api.getTaskIds === 'function') {
          const taskIds = api.getTaskIds();
          if (Array.isArray(taskIds)) {
            taskArray = taskIds.map(id => api.getTask(id)).filter(task => task);
          }
        }

        if (taskArray.length === 0 && typeof api.eachTask === 'function') {
          const tempTasks: any[] = [];
          api.eachTask((task: any) => {
            tempTasks.push(task);
          });
          taskArray = tempTasks;
        }
      }

      if (taskArray && Array.isArray(taskArray) && taskArray.length > 0) {
        let changesDetected = 0;

        const changePromises = taskArray.map(async (task: any) => {
          if (task.data && task.data.length > 0) {
            let currentlyOpen = true; // default

            if (task.open !== undefined) {
              currentlyOpen = task.open;
            } else if (task.$collapsed !== undefined) {
              currentlyOpen = !task.$collapsed;
            } else if (task.collapsed !== undefined) {
              currentlyOpen = !task.collapsed;
            }

            const previouslyOpen = taskStateRef.current.get(task.id);

            if (previouslyOpen !== undefined && previouslyOpen !== currentlyOpen) {
              taskStateRef.current.set(task.id, currentlyOpen);
              changesDetected++;

              try {
                await provider.handleExpandCollapseState({
                  id: task.id,
                  isOpen: currentlyOpen
                });

                console.log(`Estado sincronizado para tarea ${task.id}: ${currentlyOpen ? 'EXPANDIDA' : 'COLAPSADA'}`);
              } catch (syncError) {
                console.error(`Error sincronizando estado de tarea ${task.id}:`, syncError);
              }
            } else if (previouslyOpen === undefined) {
              taskStateRef.current.set(task.id, currentlyOpen);
            }
          }
        });

        await Promise.all(changePromises);

        if (changesDetected > 0) {
          console.log(`GanttChart: ${changesDetected} cambios de estado procesados`);
        }
      }
    } catch (error) {
      console.error('GanttChart: Error en detección de cambios de colapso:', error);
    }
  }, []);

  const addChildTask = useCallback(async (parentId: number | string) => {
    if (!apiRef.current || !dataProvider) return;

    try {
      const parentTaskId = dataProvider.getTaskIdFromGanttId(parentId);

      if (!parentTaskId) {
        console.error('No se encontró el ID de la tarea padre:', parentId);
        return;
      }

      await taskManager.createSubtask(parentTaskId, {
        projectId,
        name: 'Nueva Subtarea',
        description: 'Subtarea creada desde el Gantt',
        priority: 'medium',
        type: 'task',
        estimatedHours: 8,
        skipEvent: true
      });

      console.log('Subtarea creada exitosamente para padre:', parentTaskId);

    } catch (error) {
      console.error('Error creando subtarea:', error);
    }
  }, [dataProvider, projectId]);

  const initGantt = useCallback((api: any) => {
    if (!api) {
      console.warn('initGantt: api es undefined/null, se omite la inicialización');
      return;
    }

    if (apiRef.current) {
      Object.assign(apiRef.current, api);
    } else {
      Object.defineProperty(apiRef, 'current', {
        value: api,
        writable: true,
        configurable: true
      });
    }

    try {
      if (api && typeof api.setLocale === 'function') {
        console.log('Configurando localización via API');
        api.setLocale(locale);
      } else if (api && api.config) {
        console.log('Configurando localización via config');
        api.config.locale = locale;
      }
    } catch (error) {
      console.warn('No se pudo configurar la localización via API:', error);
    }

    if (dataProvider) {
      console.log('Configurando GanttDataProvider como siguiente en la cadena');

      if (typeof api.setNext === 'function') {
        api.setNext(dataProvider);
        console.log('setNext configurado exitosamente');
      } else {
        console.warn('setNext no disponible, usando configuración alternativa');
        dataProvider.setGanttApi(api);
      }

      dataProvider.setGanttApi(api);

      console.log('Estado de expand/collapse se gestiona mediante propiedad open en datos iniciales');
    }

    if (!listenersInstalledRef.current) {
      listenersInstalledRef.current = true;

      const currentTasks = api.getState()?.tasks;
      if (currentTasks && Array.isArray(currentTasks)) {
        currentTasks.forEach((task: any) => {
          recalcSummaryProgress(task.id, true);
        });
      }

      api.on('update-task', ({ id }: any) => {
        recalcSummaryProgress(id);
      });

      api.on('delete-task', ({ source }: any) => {
        recalcSummaryProgress(source, true);
      });

      api.on('copy-task', ({ id }: any) => {
        recalcSummaryProgress(id);
      });

      api.on('move-task', ({ id, source, inProgress }: any) => {
        if (inProgress) return;

        const movedTask = api.getTask(id);
        if (movedTask && movedTask.parent !== source) {
          recalcSummaryProgress(source, true);
        }
        recalcSummaryProgress(id);
      });

      setTimeout(() => {
        setupCollapseDetection(api, dataProvider);

        pollingIntervalRef.current = setInterval(() => {
          if (dataProvider && api) {
            try {
              detectCollapseChanges(api, dataProvider);
            } catch (error) {
              console.error('Error en polling detection:', error);
            }
          }
        }, 1000);
      }, 100);
    }

    console.log('Gantt API inicializado correctamente con GanttDataProvider');
  }, [dataProvider, projectId, locale]);

  useEffect(() => {
    if (apiRef.current && dataProvider) {
      const initTimer = setTimeout(() => {
        if (apiRef.current) {
          initGantt(apiRef.current);
        }
      }, 50);

      return () => clearTimeout(initTimer);
    }
  }, [dataProvider, initGantt]);

  useEffect(() => {
    (window as any).addChildTask = addChildTask;

    return () => {
      delete (window as any).addChildTask;
    };
  }, [addChildTask]);

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

  if (!loading && tasks.length === 0) {
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

  const handleAddTaskFromToolbar = async () => {
    try {
      await taskManager.createTask({
        projectId,
        name: 'Nueva Tarea',
        description: 'Tarea creada desde el toolbar',
        priority: 'medium',
        estimatedHours: 40
      });
    } catch (error) {
      console.error('GanttChart: Error creando tarea desde toolbar:', error);
    }
  };

  const toolbarItems = defaultToolbarButtons
    .filter(button => button.id !== 'edit-task' && button.id !== 'delete-task')
    .map(button => {
      if (button.id === 'add-task') {
        return {
          ...button,
          handler: handleAddTaskFromToolbar
        };
      }
      return button;
    });

  return (
    <LocaleProvider>
      <div className="h-full gantt-container relative">
        {errorBanner && (
          <div className="absolute top-2 right-2 z-50 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded shadow text-sm">
            {errorBanner}
          </div>
        )}
        <Toolbar api={apiRef.current} items={toolbarItems} />

        <Willow>
          <Gantt
            init={initGantt}
            tasks={ganttData.tasks}
            links={ganttData.links}
            scales={scales}
            columns={columns}
            markers={markers}
            cellWidth={30}
          />
        </Willow>
      </div>
    </LocaleProvider>
  );
};

export default GanttChart;
