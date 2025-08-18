import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Gantt, Willow, Toolbar, defaultToolbarButtons } from 'wx-react-gantt';
import type { Task } from '../types/firestore';
import { FirestoreGanttDataProvider } from '../services/ganttDataProvider';

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

  // Inicializar el data provider
  useEffect(() => {
    if (projectId && !dataProvider) {
      console.log('Inicializando FirestoreGanttDataProvider para proyecto:', projectId);
      const provider = new FirestoreGanttDataProvider(projectId);
      
      // Configurar listener solo para operaciones que requieren recarga completa (add/delete)
      provider.on('data-updated', async (eventData: any) => {
        console.log('Evento de actualización recibido:', eventData);
        
        // Solo recargar para operaciones que realmente lo requieren
        if (eventData.action === 'add-task' || eventData.action === 'delete-task') {
          console.log('Recargando datos para operación:', eventData.action);
          try {
            const data = await provider.getData();
            setGanttData(data);
          } catch (error) {
            console.error('Error recargando datos:', error);
          }
        } else {
          console.log('Operación no requiere recarga:', eventData.action);
        }
      });
      
      setDataProvider(provider);
    }
    
    return () => {
      if (dataProvider) {
        dataProvider.destroy();
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



  // Función global para agregar subtarea
  const addChildTask = useCallback((parentId: number) => {
    if (apiRef.current) {
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      
      apiRef.current.exec('add-task', {
        target: parentId,
        mode: 'child',
        task: {
          text: 'Nueva Subtarea',
          start: today,
          end: tomorrow,
          duration: 1,
          progress: 0,
          type: 'task'
        }
      });
    }
  }, []);

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

    console.log('Gantt API inicializado correctamente con FirestoreGanttDataProvider');
  }, [dataProvider]);

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

  // Filtrar solo los botones 'Edit' y 'Delete' de la barra de herramientas, mantener 'add-task'
  const toolbarItems = defaultToolbarButtons.filter(button => 
    button.id !== 'edit-task' && button.id !== 'delete-task'
  );

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