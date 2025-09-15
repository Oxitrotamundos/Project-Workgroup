import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Gantt, Willow, Toolbar, defaultToolbarButtons } from 'wx-react-gantt';
import type { Task } from '../types/firestore';
import { FirestoreGanttDataProvider } from '../services/ganttDataProvider';
import { taskManager } from '../services/taskManager';

// Tipos para el componente Gantt (eliminados los no utilizados)

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
  const [dataProvider, setDataProvider] = useState<FirestoreGanttDataProvider | null>(null);
  const [ganttData, setGanttData] = useState<{ tasks: any[], links: any[] }>({ tasks: [], links: [] });
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const taskStateRef = useRef<Map<number, boolean>>(new Map());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Inicializar el data provider y suscribirse a eventos del TaskManager
  useEffect(() => {
    if (projectId && !dataProvider) {
      console.log('Inicializando FirestoreGanttDataProvider para proyecto:', projectId);
      const provider = new FirestoreGanttDataProvider(projectId);

      // Configurar listener solo para operaciones que requieren recarga completa (add/delete)
      provider.on('data-updated', async (eventData: any) => {
        console.log('Evento de actualización recibido:', eventData);

        // Solo recargar para operaciones que realmente lo requieren
        // NOTE: move-task no requiere recarga ya que el Gantt maneja la UI localmente
        if (eventData.action === 'add-task' || eventData.action === 'delete-task') {
          console.log('Recargando datos para operación:', eventData.action);
          try {
            const data = await provider.getData();
            setGanttData(data);
          } catch (error) {
            console.error('Error recargando datos:', error);
          }
        } else if (eventData.action === 'sync-error') {
          // Error de sincronización - necesita recarga completa para consistencia
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

      // Suscribirse a eventos del TaskManager solo para tareas creadas externamente (fuera del Gantt)
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

      // Cleanup
      return () => {
        taskManager.off(handleTaskManagerEvent);
        
        // Cleanup mutation observer
        if (mutationObserverRef.current) {
          mutationObserverRef.current.disconnect();
          mutationObserverRef.current = null;
        }
        
        // Cleanup polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }

    return () => {
      if (dataProvider) {
        dataProvider.destroy();
      }
      
      // Cleanup mutation observer
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
        mutationObserverRef.current = null;
      }
      
      // Cleanup polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [projectId]);

  // Cargar datos iniciales
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

  // Actualizar datos cuando cambian las tareas desde props
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



  // Los datos ahora vienen del FirestoreGanttDataProvider
  // ganttData se actualiza automáticamente cuando cambian los datos en Firestore

  // Configuración de escalas de tiempo
  const scales: GanttScale[] = React.useMemo(() => [
    { unit: 'month', step: 1, format: 'MMMM yyyy' },
    { unit: 'week', step: 1, format: 'w' },
    { unit: 'day', step: 1, format: 'd' }
  ], []);

  // Configuración de columnas
  const columns: GanttColumn[] = React.useMemo(() => [
    { id: 'text', header: 'Tarea', flexGrow: 2 },
    { id: 'start', header: 'Inicio', align: 'center', flexGrow: 1 },
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
              onclick="window.addChildTask(${task.id})"
              title="Agregar subtarea"
            >
              +
            </button>
          </div>
        `;
      }
    }
  ], [dataProvider]);

  // Función para calcular diferencia de días
  const dayDiff = (next: Date, prev: Date): number => {
    const d = (next.getTime() - prev.getTime()) / 1000 / 60 / 60 / 24;
    return Math.ceil(Math.abs(d));
  };

  // Función para obtener el progreso de una summary task
  const getSummaryProgress = (id: number): number => {
    const [totalProgress, totalDuration] = collectProgressFromKids(id);
    const res = totalProgress / totalDuration;
    return isNaN(res) ? 0 : Math.round(res);
  };

  // Función para recopilar progreso de tareas hijas
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

  // Función para recalcular el progreso de summary tasks
  const recalcSummaryProgress = (id: number, self: boolean = false) => {
    if (!apiRef.current) return;

    const state = apiRef.current.getState();
    const tasks = state?.tasks;
    const task = apiRef.current.getTask(id);

    if (task && task.type !== 'milestone' && tasks && typeof tasks.getSummaryId === 'function') {
      const summary = self && task.type === 'summary' ? id : tasks.getSummaryId(id);

      if (summary) {
        const progress = getSummaryProgress(summary);
        apiRef.current.exec('update-task', {
          id: summary,
          task: { progress }
        });
      }
    }
  };

  // Optimized collapse detection using multiple methods
  const setupCollapseDetection = useCallback((api: any, provider: FirestoreGanttDataProvider | null) => {
    if (!provider || mutationObserverRef.current) return;

    // Initialize task state tracking
    const initializeTaskStates = () => {
      const tasks = api.getState()?.tasks;
      if (tasks && Array.isArray(tasks)) {
        tasks.forEach((task: any) => {
          if (task.data && task.data.length > 0) {
            // Task has children, track its open state
            const isOpen = !task.$collapsed; // wx-react-gantt uses $collapsed property
            taskStateRef.current.set(task.id, isOpen);
          }
        });
      }
    };

    // Initialize immediately and after small delay to catch late-loading tasks
    initializeTaskStates();
    setTimeout(initializeTaskStates, 200);

    // Enhanced mutation observer with better detection
    const observer = new MutationObserver((mutations) => {
      let shouldDetectChanges = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
          
          const element = mutation.target as HTMLElement;
          
          // Look for any gantt-related class changes that might indicate expand/collapse
          if (element.classList && 
              (element.classList.contains('wx-gantt-tree-cell') ||
               element.classList.contains('wx-gantt-task') ||
               element.classList.contains('wx-gantt-row') ||
               element.querySelector('.wx-gantt-tree-cell'))) {
            
            shouldDetectChanges = true;
          }
        }
        
        // Also detect when child elements are added/removed (collapse/expand effects)
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
        // Use immediate detection for better responsiveness
        setTimeout(() => {
          detectCollapseChanges(api, provider);
        }, 10);
      }
    });

    // Start observing the gantt container
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

  // Optimized collapse detection
  const detectCollapseChanges = useCallback(async (api: any, provider: FirestoreGanttDataProvider | null) => {
    if (!api || !provider) {
      return;
    }

    try {
      // Get tasks using the most reliable method (_tasks from state)
      let taskArray: any[] = [];

      // Primary method: Get tasks from state._tasks (most reliable)
      const state = api.getState();
      if (state?._tasks && Array.isArray(state._tasks)) {
        taskArray = state._tasks;
      }

      // Fallback methods if primary fails
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

        // Process collapse/expand state changes
        const changePromises = taskArray.map(async (task: any) => {
          if (task.data && task.data.length > 0) {
            // Get current collapse state from wx-react-gantt
            let currentlyOpen = true; // default

            // wx-react-gantt uses 'open' property to track state
            if (task.open !== undefined) {
              currentlyOpen = task.open;
            } else if (task.$collapsed !== undefined) {
              currentlyOpen = !task.$collapsed;
            } else if (task.collapsed !== undefined) {
              currentlyOpen = !task.collapsed;
            }

            const previouslyOpen = taskStateRef.current.get(task.id);

            if (previouslyOpen !== undefined && previouslyOpen !== currentlyOpen) {
              // State change detected
              taskStateRef.current.set(task.id, currentlyOpen);
              changesDetected++;

              try {
                // Sync with Firestore
                await provider.handleExpandCollapseState({
                  id: task.id,
                  isOpen: currentlyOpen
                });

                console.log(`Estado sincronizado para tarea ${task.id}: ${currentlyOpen ? 'EXPANDIDA' : 'COLAPSADA'}`);
              } catch (syncError) {
                console.error(`Error sincronizando estado de tarea ${task.id}:`, syncError);
              }
            } else if (previouslyOpen === undefined) {
              // First time tracking this task
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



  // Función global para agregar subtarea
  const addChildTask = useCallback(async (parentId: number) => {
    if (!apiRef.current || !dataProvider) return;

    try {
      // Obtener el firestoreId del padre usando el mapeo
      const parentFirestoreId = dataProvider.getFirestoreIdFromGanttId(parentId);

      if (!parentFirestoreId) {
        console.error('No se encontró el ID de Firestore para la tarea padre:', parentId);
        return;
      }

      // Crear subtarea con skipEvent=true para evitar recarga del componente
      await taskManager.createSubtask(parentFirestoreId, {
        projectId,
        name: 'Nueva Subtarea',
        description: 'Subtarea creada desde el Gantt',
        priority: 'medium',
        type: 'task',
        estimatedHours: 8,
        skipEvent: true // Evitar evento que causaría recarga y colapso
      });

      console.log('Subtarea creada exitosamente para padre:', parentFirestoreId);

    } catch (error) {
      console.error('Error creando subtarea:', error);
    }
  }, [dataProvider, projectId]);

  // Función de inicialización del Gantt
  const initGantt = useCallback((api: any) => {
    if (apiRef.current) {
      Object.assign(apiRef.current, api);
    } else {
      Object.defineProperty(apiRef, 'current', {
        value: api,
        writable: true,
        configurable: true
      });
    }

    // Configurar el data provider como el siguiente en la cadena de eventos
    if (dataProvider) {
      console.log('Configurando FirestoreGanttDataProvider como siguiente en la cadena');
      
      // Guard defensivo (aunque setNext funciona en nuestro caso)
      if (typeof api.setNext === 'function') {
        api.setNext(dataProvider);
        console.log('setNext configurado exitosamente');
      } else {
        console.warn('setNext no disponible, usando configuración alternativa');
        // Fallback directo sin setNext
        dataProvider.setGanttApi(api);
      }
      
      // Pasar referencia del API al dataProvider para consultas directas (sin crear loop)
      dataProvider.setGanttApi(api);
      
      // NOTA: Según documentación oficial, el estado expand/collapse se controla 
      // mediante la propiedad 'open' en los datos iniciales, no mediante API
      console.log('Estado de expand/collapse se gestiona mediante propiedad open en datos iniciales');
    }

    // Inicializar el cálculo automático de progreso para summary tasks existentes
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

    // Setup collapse detection using DOM observation + polling
    setTimeout(() => {
      setupCollapseDetection(api, dataProvider);

      // Polling para capturar cambios que el MutationObserver pueda perderse
      pollingIntervalRef.current = setInterval(() => {
        if (dataProvider && api) {
          try {
            detectCollapseChanges(api, dataProvider);
          } catch (error) {
            console.error('Error en polling detection:', error);
          }
        }
      }, 1000); // Verificar cada segundo
    }, 100);

    // Configurar listeners estándar para el progreso de summary tasks

    console.log('Gantt API inicializado correctamente con FirestoreGanttDataProvider');
  }, [dataProvider, projectId]);

  // Efecto para inicializar el Gantt cuando el dataProvider y los datos estén listos
  useEffect(() => {
    if (apiRef.current && dataProvider && ganttData.tasks.length >= 0) {
      // Retrasar la inicialización para permitir que el Gantt monte con datos
      const initTimer = setTimeout(() => {
        initGantt(apiRef.current);
      }, 50); // Pequeño delay para asegurar que el Gantt tenga datos

      return () => clearTimeout(initTimer);
    }
  }, [dataProvider, ganttData, initGantt]);

  // Configurar función global para agregar subtareas
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

  // Mostrar estado vacío cuando no hay tareas
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

  /**
   * Handler personalizado para el botón "New Task" del toolbar.
   * 
   * IMPORTANTE: Los botones del defaultToolbarButtons no vienen con handlers
   * asignados por defecto. Para que el botón "New Task" funcione, necesitamos
   * asignar manualmente un handler personalizado que use nuestro TaskManager.
   * 
   * Esta solución garantiza que:
   * - El botón "New Task" crea tareas usando el TaskManager centralizado
   * - Las tareas se sincronizan automáticamente con el GanttChart
   * - Se mantiene la consistencia del flujo de creación de tareas
   */
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

  /**
   * Configuración personalizada del toolbar.
   * 
   * - Filtra botones 'edit-task' y 'delete-task' (no implementados)
   * - Asigna handler personalizado al botón 'add-task' para usar TaskManager
   * - Mantiene todos los demás botones con su funcionalidad original
   */
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
    <div className="h-full gantt-container relative">
      {/* Barra de herramientas */}
      <Toolbar api={apiRef.current} items={toolbarItems} />

      {/* Gantt Chart */}
      <Willow>
        <Gantt
          init={initGantt}
          tasks={ganttData.tasks}
          links={ganttData.links}
          scales={scales}
          columns={columns}
          cellWidth={30}
        />
      </Willow>
    </div>
  );
};

export default GanttChart;