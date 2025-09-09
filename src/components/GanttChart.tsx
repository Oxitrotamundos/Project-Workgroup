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
  ], []);

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

    const kids = apiRef.current.getTask(id).data;

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

    const { tasks } = apiRef.current.getState();
    const task = apiRef.current.getTask(id);

    if (task && task.type !== 'milestone') {
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

  // Collapse detection workaround using DOM observation
  const setupCollapseDetection = useCallback((api: any, provider: FirestoreGanttDataProvider | null) => {
    if (!provider || mutationObserverRef.current) return;

    console.log('Setting up collapse detection using DOM observation');

    // Initialize task state tracking
    const tasks = api.getState().tasks;
    tasks.forEach((task: any) => {
      if (task.data && task.data.length > 0) {
        // Task has children, track its open state
        const isOpen = !task.$collapsed; // SVAR Gantt uses $collapsed property
        taskStateRef.current.set(task.id, isOpen);
      }
    });

    // Create mutation observer to detect DOM changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
          
          const element = mutation.target as HTMLElement;
          
          // Look for collapse/expand indicators in the DOM
          if (element.classList && 
              (element.classList.contains('wx-gantt-tree-cell') ||
               element.querySelector('.wx-gantt-tree-cell'))) {
            
            // Check if this is a collapse/expand action
            setTimeout(() => {
              detectCollapseChanges(api, provider);
            }, 50);
          }
        }
      });
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
      console.log('DOM observation started for collapse detection');
    } else {
      console.warn('Gantt container not found for collapse detection');
    }
  }, []);

  // Detect collapse changes by comparing current state with previous state
  const detectCollapseChanges = useCallback(async (api: any, provider: FirestoreGanttDataProvider | null) => {
    if (!api || !provider) return;

    try {
      const tasks = api.getState().tasks;
      
      tasks.forEach(async (task: any) => {
        if (task.data && task.data.length > 0) {
          // Task has children, check if state changed
          const currentlyOpen = !task.$collapsed;
          const previouslyOpen = taskStateRef.current.get(task.id);
          
          if (previouslyOpen !== undefined && previouslyOpen !== currentlyOpen) {
            console.log(`Task ${task.id} collapse state changed: ${previouslyOpen} -> ${currentlyOpen}`);
            
            // Update our tracking
            taskStateRef.current.set(task.id, currentlyOpen);
            
            // If task was collapsed (previouslyOpen=true, currentlyOpen=false)
            if (previouslyOpen && !currentlyOpen) {
              console.log('Task collapsed:', task.id);
              await provider.handleExpandCollapseState({
                id: task.id,
                isOpen: false
              });
            }
            // If task was expanded (handled by open-task event already)
          }
        }
      });
    } catch (error) {
      console.error('Error in collapse detection:', error);
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
      api.setNext(dataProvider);
      // Pasar referencia del API al dataProvider para consultas directas (sin crear loop)
      dataProvider.setGanttApi(api);
    }

    // Inicializar el cálculo automático de progreso para summary tasks existentes
    api.getState().tasks.forEach((task: any) => {
      recalcSummaryProgress(task.id, true);
    });

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

      if (api.getTask(id).parent !== source) {
        recalcSummaryProgress(source, true);
      }
      recalcSummaryProgress(id);
    });

    // Listen to expand events (built-in SVAR event)
    api.on('open-task', async (ev: any) => {
      console.log('Task expanded:', ev.id);
      // Update our state tracking
      taskStateRef.current.set(ev.id, true);
      
      if (dataProvider && dataProvider.handleExpandCollapseState) {
        await dataProvider.handleExpandCollapseState({
          id: ev.id,
          isOpen: true
        });
      }
    });

    // Setup collapse detection using DOM observation
    setTimeout(() => {
      setupCollapseDetection(api, dataProvider);
    }, 100);

    // Configurar listeners estándar para el progreso de summary tasks

    console.log('Gantt API inicializado correctamente con FirestoreGanttDataProvider');
  }, [dataProvider, projectId]);

  // Efecto para inicializar el Gantt cuando el dataProvider esté listo
  useEffect(() => {
    if (apiRef.current && dataProvider) {
      initGantt(apiRef.current);
    }
  }, [dataProvider, initGantt]);

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