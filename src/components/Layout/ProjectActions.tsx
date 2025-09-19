import React from 'react';
import { Calendar, Users, Plus, Filter, MoreHorizontal } from 'lucide-react';

interface ProjectActionsProps {
  onViewTeam?: () => void;
  onChangeView?: () => void;
  onAddTask?: () => void;
  onFilter?: () => void;
  onMore?: () => void;
  showAddTask?: boolean;
  showFilter?: boolean;
}

const ProjectActions: React.FC<ProjectActionsProps> = ({
  onViewTeam,
  onChangeView,
  onAddTask,
  onFilter,
  onMore,
  showAddTask = false,
  showFilter = false
}) => {
  return (
    <div className="flex items-center space-x-2">
      {/* Acciones proyecto */}
      <div className="flex items-center space-x-1">
        {showAddTask && onAddTask && (
          <button
            onClick={onAddTask}
            className="flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Nueva Tarea</span>
          </button>
        )}

        {showFilter && onFilter && (
          <button
            onClick={onFilter}
            className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <Filter className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Filtros</span>
          </button>
        )}

        {onChangeView && (
          <button
            onClick={onChangeView}
            className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <Calendar className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Vista</span>
          </button>
        )}

        {onViewTeam && (
          <button
            onClick={onViewTeam}
            className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <Users className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Equipo</span>
          </button>
        )}

        {onMore && (
          <button
            onClick={onMore}
            className="flex items-center px-2 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ProjectActions;