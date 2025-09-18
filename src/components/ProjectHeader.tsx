import React from 'react';
import { TopNavigation, ProjectActions, ProjectInfo } from './Layout';
import type { Project } from '../types/firestore';

interface ProjectHeaderProps {
  project: Project;
  tasksCount: number;
  onViewTeam?: () => void;
  onChangeView?: () => void;
  onAddTask?: () => void;
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project,
  tasksCount,
  onViewTeam,
  onChangeView,
  onAddTask
}) => {
  return (
    <>
      {/* Main Navigation */}
      <TopNavigation
        title={project.name}
        subtitle={`${tasksCount} tareas • ${project.members?.length || 0} miembros`}
        showBackButton={true}
        backTo="/dashboard"
        actions={
          <ProjectActions
            onViewTeam={onViewTeam}
            onChangeView={onChangeView}
            onAddTask={onAddTask}
            showAddTask={true}
            showFilter={true}
            tasksCount={tasksCount}
            membersCount={project.members?.length || 0}
          />
        }
      />

      {/* Project Info */}
      <ProjectInfo
        project={project}
        tasksCount={tasksCount}
        showStats={true}
      />
    </>
  );
};

export default ProjectHeader;