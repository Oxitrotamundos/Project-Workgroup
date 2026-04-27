import React, { useRef } from 'react';
import { useParams } from 'react-router-dom';
import 'wx-react-gantt/dist/gantt.css';
import '../styles/gantt-custom.css';
import { useTasks } from '../hooks/usetasks';
import { useProject } from '../hooks/useProject';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { ProjectActions, ProjectInfo } from '../components/Layout';
import GanttChart from '../components/GanttChart';
import { ProjectStateManager } from '../components/ProjectLoadingStates';
import { taskManager } from '../services/taskManager';




const ProjectView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const ganttApiRef = useRef<any>(null);
  const { user } = useAuth();
  const { updateNavigation } = useNavigation();

  const { project, loading, error, refetch } = useProject(projectId);
  const { tasks, loading: tasksLoading, error: tasksError, refetch: refetchTasks } = useTasks(projectId);
    const handleViewTeam = React.useCallback(() => {
    console.log('View team clicked');
  }, []);

  const handleChangeView = React.useCallback(() => {
    console.log('Change view clicked');
  }, []);

  const projectActions = React.useMemo(() => (
    <ProjectActions
      onViewTeam={handleViewTeam}
      onChangeView={handleChangeView}
      showFilter={true}
    />
  ), [handleViewTeam, handleChangeView]);

  const prevProjectName = React.useRef<string>();
  React.useEffect(() => {
    if (project && prevProjectName.current !== project.name) {
      updateNavigation({
        title: project.name,
        subtitle: undefined,
        actions: projectActions
      });
      prevProjectName.current = project.name;
    }
  }, [project?.name, updateNavigation, projectActions]);

  const handleAddTask = async () => {
    if (!projectId || !user) return;
    
    try {
      const taskId = await taskManager.createTask({
        projectId,
        name: 'Nueva Tarea Principal',
        description: 'Descripción de la nueva tarea',
        priority: 'medium',
        type: 'task',
      });

      console.log('Nueva tarea creada exitosamente con ID:', taskId);
      
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

  return (
    <ProjectStateManager
      loading={loading}
      error={error}
      project={project}
      onRetry={refetch}
    >
      <>
        {/* Project Info */}
        {project && (
          <ProjectInfo
            project={project}
            tasksCount={tasks.length}
            showStats={true}
          />
        )}

        {/* Gantt Chart */}
        <div className="flex-1 p-4 sm:p-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100 h-[calc(100vh-180px)] overflow-hidden">
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
      </>
    </ProjectStateManager>
  );
};

export default ProjectView;
