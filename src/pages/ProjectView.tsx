import React, { useRef } from 'react';
import { useParams } from 'react-router-dom';
import 'wx-react-gantt/dist/gantt.css';
import '../styles/gantt-custom.css';
import { useTasks } from '../hooks/usetasks';
import { useProject } from '../hooks/useProject';
import { useGanttActions } from '../hooks/useGanttActions';
import { useAuth } from '../contexts/AuthContext';
import ProjectHeader from '../components/ProjectHeader';
import GanttChart from '../components/GanttChart';
import { ProjectStateManager } from '../components/ProjectLoadingStates';
import { taskManager } from '../services/taskManager';




const ProjectView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const ganttApiRef = useRef<any>(null);
  const { user } = useAuth();
  
  // Hooks personalizados para manejar el estado y lógica
  const { project, loading, error, refetch } = useProject(projectId);
  const { tasks, loading: tasksLoading, error: tasksError, refetch: refetchTasks } = useTasks(projectId);
  
  // Hook para manejar las acciones del Gantt
  useGanttActions({
    projectId: projectId || '',
    onTasksChange: refetchTasks
  });

  // Handlers para las acciones del header
  const handleAddTask = async () => {
    if (!projectId || !user) return;
    
    try {
      const taskId = await taskManager.createTask({
        projectId,
        name: 'Nueva Tarea Principal',
        description: 'Descripción de la nueva tarea',
        assigneeId: user.id,
        priority: 'medium',
        estimatedHours: 40
      });

      console.log('Nueva tarea creada exitosamente con ID:', taskId);
      
      // El TaskManager emitirá eventos que automáticamente actualizarán el GanttChart
      // También forzar recarga de las tareas para actualizar el contador
      refetchTasks();
    } catch (error) {
      console.error('Error creando tarea:', error);
      
      if (error instanceof Error && error.message.includes('Firebase')) {
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