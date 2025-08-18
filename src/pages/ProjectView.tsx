import React, { useRef } from 'react';
import { useParams } from 'react-router-dom';
import 'wx-react-gantt/dist/gantt.css';
import '../styles/gantt-custom.css';
import { useTasks } from '../hooks/usetasks';
import { useProject } from '../hooks/useProject';
import { useGanttActions } from '../hooks/useGanttActions';
import ProjectHeader from '../components/ProjectHeader';
import GanttChart from '../components/GanttChart';
import { ProjectStateManager } from '../components/ProjectLoadingStates';




const ProjectView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const ganttApiRef = useRef<any>(null);
  
  // Hooks personalizados para manejar el estado y lógica
  const { project, loading, error, refetch } = useProject(projectId);
  const { tasks, loading: tasksLoading, error: tasksError, refetch: refetchTasks, createTask } = useTasks(projectId);
  
  // Hook para manejar las acciones del Gantt
  useGanttActions({
    projectId: projectId || '',
    onTasksChange: refetchTasks
  });

  // Handlers para las acciones del header
  const handleAddTask = async () => {
    if (!projectId) return;
    
    console.log('Iniciando creación de tarea...');
    console.log('Project ID:', projectId);
    
    try {
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const newTaskData = {
        projectId,
        name: 'Nueva Tarea Principal',
        description: 'Descripción de la nueva tarea',
        startDate: today,
        endDate: nextWeek,
        duration: 7,
        progress: 0,
        dependencies: [],
        tags: [],
        priority: 'medium' as const,
        color: '#3B82F6',
        estimatedHours: 40,
        status: 'not-started' as const
      };
      
      console.log('Datos de la tarea:', newTaskData);
      
      // Usar la función createTask del hook que maneja automáticamente la recarga
      const taskId = await createTask(newTaskData);
      
      console.log('Nueva tarea creada exitosamente con ID:', taskId);
    } catch (error) {
      console.error('Error al crear la tarea:', error);
      
      // Verificar si es un error de configuración de Firebase
      if (error instanceof Error && error.message.includes('Firebase')) {
        console.error('Error de configuración de Firebase. Asegúrate de que el archivo .env esté configurado correctamente.');
        alert('Error: Firebase no está configurado. Por favor, configura el archivo .env con las credenciales de Firebase.');
      } else {
        alert('Error al crear la tarea. Revisa la consola para más detalles.');
      }
    }
  };

  const handleViewTeam = () => {
    console.log('View team clicked');
    // Aquí se podría abrir un modal para ver el equipo
  };

  const handleChangeView = () => {
    console.log('Change view clicked');
    // Aquí se podría cambiar entre diferentes vistas del Gantt
  };

  // Funcionalidades de Firestore implementadas para creación de tareas

  return (
    <ProjectStateManager
      loading={loading}
      error={error}
      project={project}
      onRetry={refetch}
    >
      <div className="min-h-screen bg-gray-50">
        {/* Header del proyecto */}
        <ProjectHeader
          project={project!}
          tasksCount={tasks.length}
          onAddTask={handleAddTask}
          onViewTeam={handleViewTeam}
          onChangeView={handleChangeView}
        />

        {/* Gantt Chart */}
        <div className="flex-1 p-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100 h-[calc(100vh-200px)] overflow-hidden">
            <GanttChart
              tasks={tasks}
              projectId={projectId || ''}
              loading={tasksLoading}
              error={tasksError}
              apiRef={ganttApiRef}
              onAddTask={handleAddTask}
            />
          </div>
        </div>
      </div>
    </ProjectStateManager>
  );
};

export default ProjectView;