import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gantt, Willow } from 'wx-react-gantt';
import 'wx-react-gantt/dist/gantt.css';
import '../styles/gantt-custom.css';
import { useAuth } from '../contexts/AuthContext';
import { ProjectService } from '../services/projectService';
import { useTasks } from '../hooks/usetasks';
import type { Project, Task } from '../types/firestore';
import { ArrowLeft, Calendar, Users, Settings, Plus } from 'lucide-react';

// Tipos para el componente Gantt
interface GanttTask {
  id: number;
  text: string;
  start: Date;
  end: Date;
  duration: number;
  progress: number;
  type: 'task' | 'summary';
  parent?: number;
  lazy?: boolean;
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

const ProjectView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const apiRef = useRef<any>(null);
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Hook para gestionar tareas del proyecto
  const { tasks, loading: tasksLoading, error: tasksError } = useTasks(projectId);

  // Cargar información del proyecto
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || !user) return;

      try {
        setLoading(true);
        setError(null);

        // Verificar acceso al proyecto
        const hasAccess = await ProjectService.hasAccess(projectId, user.uid);
        if (!hasAccess) {
          setError('No tienes acceso a este proyecto');
          return;
        }

        // Cargar datos del proyecto
        const projectData = await ProjectService.getProject(projectId);
        if (!projectData) {
          setError('Proyecto no encontrado');
          return;
        }

        setProject(projectData);
      } catch (err) {
        console.error('Error loading project:', err);
        setError('Error al cargar el proyecto');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, user]);

  // Convertir tareas de Firestore al formato del Gantt
  const convertTasksToGantt = (tasks: Task[]): GanttTask[] => {
    return tasks.map((task, index) => {
      const startDate = task.startDate instanceof Date ? task.startDate : task.startDate.toDate();
      const endDate = task.endDate instanceof Date ? task.endDate : task.endDate.toDate();
      
      return {
        id: parseInt(task.id.replace(/\D/g, '')) || index + 1, // Convertir ID a número
        text: task.name,
        start: startDate,
        end: endDate,
        duration: task.duration,
        progress: task.progress,
        type: 'task' as const,
        lazy: false
      };
    });
  };

  // Función para generar datos de ejemplo más realistas
  const generateSampleData = (): { tasks: GanttTask[], links: GanttLink[] } => {
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
        text: project?.name || 'Sistema de Gestión de Proyectos',
        start: today,
        end: new Date(today.getTime() + threeMonths),
        duration: 90,
        progress: 35,
        type: 'summary'
      },
      {
        id: 2,
        text: 'Fase 1: Planificación y Análisis',
        start: today,
        end: new Date(today.getTime() + oneMonth),
        duration: 30,
        progress: 90,
        type: 'summary',
        parent: 1
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
        parent: 1
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
        parent: 1
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
      { id: 10, source: 13, target: 14, type: 'e2s' }
    ];

    return { tasks: sampleTasks, links: sampleLinks };
  };

  // Preparar datos para el Gantt
  const ganttTasks = tasks.length > 0 ? convertTasksToGantt(tasks) : generateSampleData().tasks;
  const ganttLinks = tasks.length > 0 ? [] : generateSampleData().links;

  // Configuración de escalas de tiempo mejorada
  const scales: GanttScale[] = [
    { unit: 'month', step: 1, format: 'MMMM yyyy' },
    { unit: 'week', step: 1, format: 'w' },
    { unit: 'day', step: 1, format: 'd' }
  ];

  // Configuración de columnas
  const columns = [
    { id: 'text', header: 'Tarea', flexGrow: 2 },
    { id: 'start', header: 'Inicio', flexGrow: 1, align: 'center' as const },
    { id: 'duration', header: 'Duración', align: 'center' as const, flexGrow: 1 },
    { id: 'progress', header: 'Progreso', align: 'center' as const, flexGrow: 1 }
  ];

  // Manejo de eventos del Gantt
  const handleGanttInit = (api: any) => {
    apiRef.current = api;
    
    // Escuchar eventos de actualización
    api.on('update-task', (event: any) => {
      console.log('Task updated:', event);
      // Aquí se podría sincronizar con Firestore
    });

    api.on('add-task', (event: any) => {
      console.log('Task added:', event);
      // Aquí se podría crear una nueva tarea en Firestore
    });

    api.on('delete-task', (event: any) => {
      console.log('Task deleted:', event);
      // Aquí se podría eliminar la tarea de Firestore
    });
  };

//TODO: Implementar las funcionalidades de Firestore - Atte. AB

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Proyecto no encontrado</h2>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center space-x-3">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: project.color }}
                ></div>
                <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                <Calendar className="w-4 h-4 mr-2" />
                Vista
              </button>
              <button className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                <Users className="w-4 h-4 mr-2" />
                Miembros
              </button>
              <button className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                <Settings className="w-4 h-4 mr-2" />
                Configuración
              </button>
              <button className="flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Tarea
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Project Info */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">{project.description}</p>
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                <span>Estado: <span className="font-medium">{project.status}</span></span>
                <span>•</span>
                <span>Miembros: <span className="font-medium">{project.members.length}</span></span>
                <span>•</span>
                <span>Tareas: <span className="font-medium">{tasks.length}</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="flex-1 p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[calc(100vh-280px)]">
          {tasksLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Cargando tareas...</p>
              </div>
            </div>
          ) : tasksError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-red-600 mb-2">Error al cargar tareas</p>
                <p className="text-gray-600 text-sm">{tasksError}</p>
              </div>
            </div>
          ) : (
            <div className="h-full gantt-container">
              {tasks.length === 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 m-4">
                  <div className="flex items-center">
                    <div className="text-blue-600 mr-3">ℹ️</div>
                    <div>
                      <h3 className="text-blue-800 font-medium">Vista Previa del Gantt</h3>
                      <p className="text-blue-700 text-sm mt-1">
                        Este es un ejemplo de cómo se verá el diagrama de Gantt. 
                        Agrega tareas reales para ver tu proyecto en acción.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <Willow>
                <Gantt
                  tasks={ganttTasks}
                  links={ganttLinks}
                  scales={scales}
                  columns={columns}
                  init={handleGanttInit}
                />
              </Willow>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectView;