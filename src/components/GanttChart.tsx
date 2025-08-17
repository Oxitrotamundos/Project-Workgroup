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
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onTaskAdd?: (task: Partial<Task>) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskSelect?: (taskId: string) => void;
  apiRef?: React.RefObject<any>;
}

const GanttChart: React.FC<GanttChartProps> = ({
  tasks,
  projectName,
  loading = false,
  error = null,
  onTaskUpdate,
  onTaskAdd,
  onTaskDelete,
  onTaskSelect,
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

  // Función para convertir tarea a summary cuando tiene hijos
  const toSummary = useCallback((id: number) => {
    if (apiRef.current) {
      const task = apiRef.current.getTask(id);
      if (task && task.type !== 'summary') {
        apiRef.current.exec('update-task', {
          id,
          task: { type: 'summary' }
        });
      }
    }
  }, []);

  // Función para convertir summary a tarea cuando no tiene hijos
  const toTask = useCallback((id: number) => {
    if (apiRef.current) {
      const task = apiRef.current.getTask(id);
      if (task && task.type === 'summary' && (!task.data || task.data.length === 0)) {
        apiRef.current.exec('update-task', {
          id,
          task: { type: 'task' }
        });
      }
    }
  }, []);

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

  // Configurar eventos cuando el Gantt esté listo
  useEffect(() => {
    // Hacer la función global accesible
    (window as any).addChildTask = addChildTask;

    if (apiRef.current) {
      // Escuchar eventos de actualización
      const handleUpdateTask = (event: any) => {
        console.log('Task updated:', event);
        if (onTaskUpdate) {
          // Convertir de vuelta al formato de Firestore
          const updates = {
            name: event.task.text,
            startDate: event.task.start,
            endDate: event.task.end,
            duration: event.task.duration,
            progress: event.task.progress
          };
          onTaskUpdate(event.id.toString(), updates);
        }
      };

      const handleAddTask = (event: any) => {
        console.log('Task added:', event);
        
        // Si se agrega como hijo, convertir el padre a summary
        if (event.mode === 'child' && event.target) {
          toSummary(event.target);
        }
        
        if (onTaskAdd) {
          const newTask = {
            name: event.task.text || 'Nueva Tarea',
            startDate: event.task.start || new Date(),
            endDate: event.task.end || new Date(),
            duration: event.task.duration || 1,
            progress: event.task.progress || 0,
            description: event.task.details || ''
          };
          onTaskAdd(newTask);
        }
      };

      const handleDeleteTask = (event: any) => {
        console.log('Task deleted:', event);
        
        // Si se elimina una tarea, verificar si el padre debe convertirse a task
        if (event.source) {
          setTimeout(() => toTask(event.source), 100);
        }
        
        if (onTaskDelete) {
          onTaskDelete(event.id.toString());
        }
      };

      const handleMoveTask = (event: any) => {
        console.log('Task moved:', event);
        
        if (event.inProgress) return;
        
        // Si se mueve como hijo, convertir el nuevo padre a summary
        if (event.mode === 'child' && event.target) {
          toSummary(event.target);
        }
        
        // Verificar si el padre anterior debe convertirse a task
        if (event.source) {
          setTimeout(() => toTask(event.source), 100);
        }
      };

      const handleSelectTask = (event: any) => {
        console.log('Task selected:', event.id);
        if (onTaskSelect) {
          onTaskSelect(event.id.toString());
        }
      };

      // Registrar eventos
      apiRef.current.on('update-task', handleUpdateTask);
      apiRef.current.on('add-task', handleAddTask);
      apiRef.current.on('delete-task', handleDeleteTask);
      apiRef.current.on('move-task', handleMoveTask);
      apiRef.current.on('select-task', handleSelectTask);

      // Cleanup
      return () => {
        if (apiRef.current) {
          apiRef.current.off('update-task', handleUpdateTask);
          apiRef.current.off('add-task', handleAddTask);
          apiRef.current.off('delete-task', handleDeleteTask);
          apiRef.current.off('move-task', handleMoveTask);
          apiRef.current.off('select-task', handleSelectTask);
        }
        // Limpiar función global
        delete (window as any).addChildTask;
      };
    }
  }, [onTaskUpdate, onTaskAdd, onTaskDelete, onTaskSelect, addChildTask, toSummary, toTask]);

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
          tasks={ganttData.tasks}
          links={ganttData.links}
          scales={scales}
          columns={columns}
          api={apiRef}
        />
      </Willow>
    </div>
  );
};

export default GanttChart;