import React from 'react';
import type { Project } from '../../types/firestore';

interface ProjectInfoProps {
  project: Project;
  tasksCount?: number;
  className?: string;
  showStats?: boolean;
}

const ProjectInfo: React.FC<ProjectInfoProps> = ({
  project,
  tasksCount,
  className = '',
  showStats = true
}) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'activo':
        return 'bg-green-400';
      case 'completed':
      case 'completado':
        return 'bg-blue-400';
      case 'paused':
      case 'pausado':
        return 'bg-yellow-400';
      case 'cancelled':
      case 'cancelado':
        return 'bg-red-400';
      default:
        return 'bg-gray-400';
    }
  };

  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'active': 'Activo',
      'completed': 'Completado',
      'paused': 'Pausado',
      'cancelled': 'Cancelado'
    };
    return statusMap[status.toLowerCase()] || status;
  };

  return (
    <div className={`bg-white/60 backdrop-blur-sm border-b border-gray-50 ${className}`}>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          {/* Descripción proyecto */}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-600 truncate max-w-2xl">
              {project.description || 'Sin descripción'}
            </p>
          </div>

          {/* Estadísticas proyecto */}
          {showStats && (
            <div className="flex items-center space-x-6 text-xs text-gray-500 ml-4">
              <span className="flex items-center">
                <span className={`w-1.5 h-1.5 ${getStatusColor(project.status)} rounded-full mr-2`}></span>
                {formatStatus(project.status)}
              </span>

              <span className="hidden sm:inline">{project.members?.length || 0} miembros</span>

              {tasksCount !== undefined && (
                <span className="hidden sm:inline">{tasksCount} tareas</span>
              )}

              {/* Fecha creación - Oculta en pantallas pequeñas */}
              {project.createdAt && (
                <span className="hidden md:inline">
                  Creado {
                    project.createdAt instanceof Date
                      ? project.createdAt.toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })
                      : new Date(project.createdAt.seconds * 1000).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })
                  }
                </span>
              )}
            </div>
          )}
        </div>

        {/* Estadísticas proyecto - Mostrar en pantallas pequeñas cuando las principales estadísticas están ocultas */}
        {showStats && (
          <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2 sm:hidden">
            <span>{project.members?.length || 0} miembros</span>
            {tasksCount !== undefined && <span>{tasksCount} tareas</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectInfo;