import React, { useRef, useEffect, useCallback } from 'react';
import { Gantt, Willow, Toolbar, defaultToolbarButtons } from 'wx-react-gantt';
import type { Task } from '../types/firestore';

// Tipos para el componente Gantt
interface GanttTask {
  id: number;
  text: string;
  start: Date;
  end: Date;
  duration: number;
  progress: number;
  type: 'task' | 'summary' | 'milestone';
  parent?: number;
  lazy?: boolean;
  open?: boolean;
  details?: string;
}

interface GanttLink {
  id: number;
  source: number;
  target: number;
  type: 'e2s' | 's2s' | 'e2e' | 's2e';
}

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
  projectName?: string;
  loading?: boolean;
  error?: string | null;
  apiRef?: React.RefObject<any>;
}

const GanttChart: React.FC<GanttChartProps> = ({
  tasks,
  projectName,
  loading = false,
  error = null,
  apiRef: externalApiRef
}) => {
  const internalApiRef = useRef<any>(null);
  const apiRef = externalApiRef || internalApiRef;

  // Convertir tareas de Firestore al formato del Gantt
  const convertTasksToGantt = useCallback((tasks: Task[]): GanttTask[] => {
    return tasks.map((task, index) => {
      const startDate = task.startDate instanceof Date ? task.startDate : task.startDate.toDate();
      const endDate = task.endDate instanceof Date ? task.endDate : task.endDate.toDate();
      
      return {
        id: parseInt(task.id.replace(/\D/g, '')) || index + 1,
        text: task.name,
        start: startDate,
        end: endDate,
        duration: task.duration,
        progress: task.progress,
        type: 'task' as const,
        lazy: false,
        details: task.description || ''
      };
    });
  }, []);

  // Función para generar datos de ejemplo más realistas
  const generateSampleData = useCallback((): { tasks: GanttTask[], links: GanttLink[] } => {
    const today = new Date();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const twoWeeks = 14 * 24 * 60 * 60 * 1000;
    const threeWeeks = 21 * 24 * 60 * 60 * 1000;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    const twoMonths = 60 * 24 * 60 * 60 * 1000;
    const threeMonths = 90 * 24 * 60 * 60 * 1000;

    const sampleTasks: GanttTask[] = [
      {
        id: 1,
        text: projectName || 'Sistema de Gestión de Proyectos',
        start: today,
        end: new Date(today.getTime() + threeMonths),
        duration: 90,
        progress: 35,
        type: 'summary',
        open: true
      },
      {
        id: 2,
        text: 'Fase 1: Planificación y Análisis',
        start: today,
        end: new Date(today.getTime() + oneMonth),
        duration: 30,
        progress: 90,
        type: 'summary',
        parent: 1,
        open: true
      },
      {
        id: 3,
        text: 'Análisis de Requisitos',
        start: today,
        end: new Date(today.getTime() + oneWeek),
        duration: 7,
        progress: 100,
        type: 'task',
        parent: 2
      },
      {
        id: 4,
        text: 'Diseño de UX/UI',
        start: new Date(today.getTime() + oneWeek - 2 * 24 * 60 * 60 * 1000),
        end: new Date(today.getTime() + twoWeeks + 3 * 24 * 60 * 60 * 1000),
        duration: 10,
        progress: 85,
        type: 'task',
        parent: 2
      },
      {
        id: 5,
        text: 'Arquitectura del Sistema',
        start: new Date(today.getTime() + twoWeeks),
        end: new Date(today.getTime() + oneMonth),
        duration: 14,
        progress: 75,
        type: 'task',
        parent: 2
      },
      {
        id: 6,
        text: 'Fase 2: Desarrollo',
        start: new Date(today.getTime() + oneMonth),
        end: new Date(today.getTime() + twoMonths + oneWeek),
        duration: 37,
        progress: 40,
        type: 'summary',
        parent: 1,
        open: true
      },
      {
        id: 7,
        text: 'Configuración del Entorno',
        start: new Date(today.getTime() + oneMonth),
        end: new Date(today.getTime() + oneMonth + 3 * 24 * 60 * 60 * 1000),
        duration: 3,
        progress: 100,
        type: 'task',
        parent: 6
      },
      {
        id: 8,
        text: 'Desarrollo Frontend',
        start: new Date(today.getTime() + oneMonth + 3 * 24 * 60 * 60 * 1000),
        end: new Date(today.getTime() + twoMonths),
        duration: 27,
        progress: 55,
        type: 'task',
        parent: 6
      },
      {
        id: 9,
        text: 'Desarrollo Backend',
        start: new Date(today.getTime() + oneMonth + 3 * 24 * 60 * 60 * 1000),
        end: new Date(today.getTime() + twoMonths + 5 * 24 * 60 * 60 * 1000),
        duration: 32,
        progress: 35,
        type: 'task',
        parent: 6
      },
      {
        id: 10,
        text: 'Integración de APIs',
        start: new Date(today.getTime() + twoMonths),
        end: new Date(today.getTime() + twoMonths + oneWeek),
        duration: 7,
        progress: 20,
        type: 'task',
        parent: 6
      },
      {
        id: 11,
        text: 'Fase 3: Testing y Despliegue',
        start: new Date(today.getTime() + twoMonths + oneWeek),
        end: new Date(today.getTime() + threeMonths),
        duration: 23,
        progress: 0,
        type: 'summary',
        parent: 1,
        open: true
      },
      {
        id: 12,
        text: 'Pruebas Unitarias',
        start: new Date(today.getTime() + twoMonths + oneWeek),
        end: new Date(today.getTime() + twoMonths + twoWeeks),
        duration: 7,
        progress: 0,
        type: 'task',
        parent: 11
      },
      {
        id: 13,
        text: 'Pruebas de Integración',
        start: new Date(today.getTime() + twoMonths + oneWeek + 5 * 24 * 60 * 60 * 1000),
        end: new Date(today.getTime() + twoMonths + threeWeeks),
        duration: 9,
        progress: 0,
        type: 'task',
        parent: 11
      },
      {
        id: 14,
        text: 'Despliegue en Producción',
        start: new Date(today.getTime() + twoMonths + threeWeeks),
        end: new Date(today.getTime() + threeMonths - 3 * 24 * 60 * 60 * 1000),
        duration: 4,
        progress: 0,
        type: 'task',
        parent: 11
      },
      {
        id: 15,
        text: 'Lanzamiento',
        start: new Date(today.getTime() + threeMonths),
        end: new Date(today.getTime() + threeMonths),
        duration: 0,
        progress: 0,
        type: 'milestone',
        parent: 1
      }
    ];

    const sampleLinks: GanttLink[] = [
      { id: 1, source: 3, target: 4, type: 'e2s' },
      { id: 2, source: 4, target: 5, type: 's2s' },
      { id: 3, source: 5, target: 7, type: 'e2s' },
      { id: 4, source: 7, target: 8, type: 'e2s' },
      { id: 5, source: 7, target: 9, type: 'e2s' },
      { id: 6, source: 8, target: 10, type: 'e2s' },
      { id: 7, source: 9, target: 10, type: 'e2s' },
      { id: 8, source: 10, target: 12, type: 'e2s' },
      { id: 9, source: 12, target: 13, type: 's2s' },
      { id: 10, source: 13, target: 14, type: 'e2s' },
      { id: 11, source: 14, target: 15, type: 'e2s' }
    ];

    return { tasks: sampleTasks, links: sampleLinks };
  }, [projectName]);

  // Preparar datos para el Gantt
  const ganttData = React.useMemo(() => {
    if (tasks.length > 0) {
      return {
        tasks: convertTasksToGantt(tasks),
        links: [] as GanttLink[]
      };
    }
    return generateSampleData();
  }, [tasks, convertTasksToGantt, generateSampleData]);

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
  const initGantt = (api: any) => {
    if (apiRef.current) {
      Object.assign(apiRef.current, api);
    } else {
      Object.defineProperty(apiRef, 'current', {
        value: api,
        writable: true,
        configurable: true
      });
    }

    // Inicializar el cálculo automático de progreso para summary tasks existentes
    api.getState().tasks.forEach((task: any) => {
      recalcSummaryProgress(task.id, true);
    });

    // Escuchar eventos solo para el cálculo de progreso automático
    api.on('add-task', ({ id }: any) => {
      recalcSummaryProgress(id);
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
  };

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

  // Filtrar los botones 'New task', 'Edit' y 'Delete' de la barra de herramientas
  const toolbarItems = defaultToolbarButtons.filter(button => 
    button.id !== 'add-task' && button.id !== 'edit-task' && button.id !== 'delete-task'
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