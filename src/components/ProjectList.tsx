import React, { useState } from 'react';
import type { Project, ProjectStatus } from '../types/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import { Timestamp } from 'firebase/firestore';

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (projectId: string) => void;
  onView: (projectId: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onEdit, onDelete, onView }) => {
  const { user } = useAuth();
  const { isAdmin, isPM } = useUserRole();
  const isOwner = user?.uid === project.ownerId;
  const isMember = project.members.includes(user?.uid || '');
  
  // Permisos según rol
  const canEdit = isAdmin || isOwner || (isPM && isMember);
  const canDelete = isAdmin || isOwner;
  const canView = isAdmin || isOwner || isMember;

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case 'planning':
        return 'bg-yellow-100 text-yellow-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'on-hold':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: ProjectStatus) => {
    switch (status) {
      case 'planning':
        return 'Planificación';
      case 'active':
        return 'Activo';
      case 'completed':
        return 'Completado';
      case 'on-hold':
        return 'En Pausa';
      default:
        return status;
    }
  };

  const formatDate = (date: Date | Timestamp) => {
    const dateObj = date instanceof Date ? date : date.toDate();
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(dateObj);
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border border-gray-200">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div 
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {project.name}
              </h3>
            </div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
              {getStatusText(project.status)}
            </span>
          </div>
          
          {/* Menu de acciones */}
          <div className="flex items-center gap-2">
            {canView && (
              <button
                onClick={() => onView(project.id)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Ver proyecto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            )}
            
            {canEdit && (
              <button
                onClick={() => onEdit(project)}
                className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                title="Editar proyecto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            
            {canDelete && (
              <button
                onClick={() => onDelete(project.id)}
                className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                title="Eliminar proyecto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            
            {/* Indicador de rol para administradores */}
            {isAdmin && (
              <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                Admin
              </span>
            )}
          </div>
        </div>

        {/* Descripción */}
        {project.description && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Fechas */}
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formatDate(project.startDate)} - {formatDate(project.endDate)}</span>
          </div>
        </div>

        {/* Miembros */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <span className="text-sm text-gray-600">
              {project.members.length} miembro{project.members.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="text-xs text-gray-400">
            Actualizado {formatDate(project.updatedAt)}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ProjectListProps {
  projects: Project[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onViewProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => Promise<void>;
  onLoadMore: () => Promise<void>;
}

const ProjectList: React.FC<ProjectListProps> = ({ 
  projects,
  loading,
  error,
  hasMore,
  onCreateProject, 
  onEditProject, 
  onViewProject,
  onDeleteProject,
  onLoadMore
}) => {
  const { isAdmin, isPM } = useUserRole();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Solo administradores y PMs pueden crear proyectos
  const canCreateProject = isAdmin || isPM;

  const handleDelete = async (projectId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este proyecto? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setDeletingId(projectId);
      await onDeleteProject(projectId);
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Error al eliminar el proyecto. Por favor, inténtalo de nuevo.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && projects.length === 0) {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
        
        {/* Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                <div className="h-16 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold">Error al cargar proyectos</h3>
          <p className="text-gray-600 mt-2">{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isAdmin ? 'Todos los Proyectos' : 'Mis Proyectos'}
          </h2>
          <p className="text-gray-600 mt-1">
            {projects.length} proyecto{projects.length !== 1 ? 's' : ''} encontrado{projects.length !== 1 ? 's' : ''}
            {isAdmin && <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">Vista de Administrador</span>}
          </p>
        </div>
        
        {canCreateProject && (
          <button
            onClick={onCreateProject}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Proyecto
          </button>
        )}
      </div>

      {/* Lista de proyectos */}
      {projects.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay proyectos</h3>
            <p className="text-gray-600 mb-6">
              {canCreateProject 
                ? 'Comienza creando tu primer proyecto para gestionar tareas y equipos.'
                : 'No tienes acceso a ningún proyecto. Contacta con un administrador o PM para que te agregue a un proyecto.'
              }
            </p>
            {canCreateProject && (
              <button
                onClick={onCreateProject}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Crear Primer Proyecto
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div key={project.id} className={deletingId === project.id ? 'opacity-50 pointer-events-none' : ''}>
                <ProjectCard
                  project={project}
                  onEdit={onEditProject}
                  onDelete={handleDelete}
                  onView={onViewProject}
                />
              </div>
            ))}
          </div>

          {/* Botón cargar más */}
          {hasMore && (
            <div className="text-center">
              <button
                onClick={onLoadMore}
                disabled={loading}
                className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Cargando...' : 'Cargar Más Proyectos'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProjectList;