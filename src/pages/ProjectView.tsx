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
  const { tasks, loading: tasksLoading, error: tasksError, refetch: refetchTasks } = useTasks(projectId);
  
  // Hook para manejar las acciones del Gantt
  useGanttActions({
    projectId: projectId || '',
    onTasksChange: refetchTasks
  });

  // Handlers para las acciones del header
  const handleAddTask = () => {
    console.log('Add task clicked');
    // Crear una nueva tarea principal usando la API del Gantt
    if (ganttApiRef.current) {
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      ganttApiRef.current.exec('add-task', {
        task: {
          text: 'Nueva Tarea Principal',
          start: today,
          end: nextWeek,
          duration: 7,
          progress: 0,
          type: 'task'
        }
      });
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

  //TODO: Implementar las funcionalidades de Firestore - Atte. AB

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
              projectName={project?.name}
              loading={tasksLoading}
              error={tasksError}
              apiRef={ganttApiRef}
            />
          </div>
        </div>
      </div>
    </ProjectStateManager>
  );
};

export default ProjectView;