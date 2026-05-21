import React from 'react';
import CalendarChip from './CalendarChip';
import type { ProjectActionsProps } from '../../types/navigation';

const ProjectActions: React.FC<ProjectActionsProps> = ({
  onOpenCalendar,
  calendar,
  className = '',
}) => {
  if (!onOpenCalendar) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <CalendarChip calendar={calendar ?? null} onClick={onOpenCalendar} />
    </div>
  );
};

export default ProjectActions;
