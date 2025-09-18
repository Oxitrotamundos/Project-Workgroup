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
        showBackButton={true}
        backTo="/dashboard"
        actions={
          <ProjectActions
            onViewTeam={onViewTeam}
            onChangeView={onChangeView}
            showFilter={true}
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