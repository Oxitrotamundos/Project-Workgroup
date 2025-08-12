import React, { useState } from 'react';
import type { Project, ProjectStatus } from '../types/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import { Timestamp } from 'firebase/firestore';
import MemberModal from './MemberModal';
import { 
  Eye, 
  Users, 
  Edit3, 
  Trash2, 
  Calendar, 
  Plus, 
  FolderOpen, 
  AlertCircle,
  Clock
} from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (projectId: string) => void;
  onView: (projectId: string) => void;
  onManageMembers: (project: Project) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onEdit, onDelete, onView, onManageMembers }) => {
  const { user } = useAuth();
  const { isAdmin, isPM } = useUserRole();
  const isOwner = user?.uid === project.ownerId;
  const isMember = project.members.includes(user?.uid || '');
  
  // Permisos según rol
  const canEdit = isAdmin || isOwner || (isPM && isMember);
  const canDelete = isAdmin || isOwner;
  const canView = isAdmin || isOwner || isMember;
  const canManageMembers = isAdmin || isPM;

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
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 hover:border-gray-200 h-full flex flex-col">
      <div className="p-5 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {project.name}
              </h3>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
              {getStatusText(project.status)}
            </span>
          </div>
          
          {/* Menu de acciones */}
          <div className="flex items-center gap-1 ml-3">
            {canView && (
              <button
                onClick={() => onView(project.id)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                title="Ver proyecto"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
            
            {canManageMembers && (
              <button
                onClick={() => onManageMembers(project)}
                className="p-2 text-gray-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
                title="Gestionar miembros"
              >
                <Users className="w-4 h-4" />
              </button>
            )}
            
            {canEdit && (
              <button
                onClick={() => onEdit(project)}
                className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                title="Editar proyecto"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            
            {canDelete && (
              <button
                onClick={() => onDelete(project.id)}
                className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                title="Eliminar proyecto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Indicador de rol para administradores */}
        {isAdmin && (
          <div className="mb-4">
            <span className="inline-flex items-center px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full font-medium">
              Admin
            </span>
          </div>
        )}

        {/* Descripción */}
        {project.description && (
          <div className="mb-4 flex-1">
            <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
              {project.description}
            </p>
          </div>
        )}

        {/* Contenido inferior */}
        <div className="mt-auto space-y-4">
          {/* Fechas */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {formatDate(project.startDate)} - {formatDate(project.endDate)}
            </span>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-600">
                {project.members.length} miembro{project.members.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              <span className="truncate">
                {formatDate(project.updatedAt)}
              </span>
            </div>
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
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Solo administradores y PMs pueden crear proyectos
  const canCreateProject = isAdmin || isPM;

  const handleManageMembers = (project: Project) => {
    setSelectedProject(project);
    setMemberModalOpen(true);
  };

  const closeMemberModal = () => {
    setMemberModalOpen(false);
    setSelectedProject(null);
  };

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-5 h-64">
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                <div className="flex-1 bg-gray-200 rounded animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                </div>
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
          <AlertCircle className="w-12 h-12 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Error al cargar proyectos</h3>
          <p className="text-gray-600 mt-2">{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
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
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Nuevo Proyecto
          </button>
        )}
      </div>

      {/* Lista de proyectos */}
      {projects.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-gray-400 mb-4">
            <FolderOpen className="w-16 h-16 mx-auto mb-6 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-900 mb-3">No hay proyectos</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
              {canCreateProject 
                ? 'Comienza creando tu primer proyecto para gestionar tareas y equipos de manera eficiente.'
                : 'No tienes acceso a ningún proyecto. Contacta con un administrador o PM para que te agregue a un proyecto.'
              }
            </p>
            {canCreateProject && (
              <button
                onClick={onCreateProject}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-5 h-5" />
                Crear Primer Proyecto
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {projects.map((project) => (
              <div 
                key={project.id} 
                className={`transition-opacity duration-200 ${deletingId === project.id ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <ProjectCard
                  project={project}
                  onEdit={onEditProject}
                  onDelete={handleDelete}
                  onView={onViewProject}
                  onManageMembers={handleManageMembers}
                />
              </div>
            ))}
          </div>

          {/* Botón cargar más */}
          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={onLoadMore}
                disabled={loading}
                className="bg-gray-50 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 shadow-sm"
              >
                {loading ? 'Cargando...' : 'Cargar Más Proyectos'}
              </button>
            </div>
          )}
        </>
      )}
      
      {/* Modal de gestión de miembros */}
      {selectedProject && (
        <MemberModal
          isOpen={memberModalOpen}
          onClose={closeMemberModal}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
        />
      )}
    </div>
  );
};

export default ProjectList;