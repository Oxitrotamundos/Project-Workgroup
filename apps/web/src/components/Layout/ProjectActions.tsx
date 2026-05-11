import React from 'react';
import { Clock } from 'lucide-react';
import type { ProjectActionsProps } from '../../types/navigation';

const ProjectActions: React.FC<ProjectActionsProps> = ({
  onOpenCalendar,
  className = '',
}) => {
  if (!onOpenCalendar) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={onOpenCalendar}
        className="btn btn-ghost btn-sm"
        title="Calendario laboral del proyecto"
      >
        <Clock className="w-4 h-4" />
        <span className="hidden sm:inline">Calendario</span>
      </button>
    </div>
  );
};

export default ProjectActions;
