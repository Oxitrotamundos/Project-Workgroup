import React, { useState } from 'react';
import type { Project, ProjectStatus } from '../types/domain';
import { useAuth } from '../contexts/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
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
  Clock,
} from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (projectId: string) => void;
  onView: (projectId: string) => void;
  onManageMembers: (project: Project) => void;
}

const STATUS_VARIANT: Record<ProjectStatus, 'warn' | 'ok' | 'info' | 'err' | 'outline'> = {
  planning: 'warn',
  active: 'ok',
  completed: 'info',
  'on-hold': 'err',
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planificación',
  active: 'Activo',
  completed: 'Completado',
  'on-hold': 'En Pausa',
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(date));

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onEdit, onDelete, onView, onManageMembers }) => {
  const { user } = useAuth();
  const { isAdmin, isPM } = useUserRole();
  const isOwner = user?.uid === project.ownerId;
  const isMember = project.members.includes(user?.uid || '');

  const canEdit = isAdmin || isOwner || (isPM && isMember);
  const canDelete = isAdmin || isOwner;
  const canView = isAdmin || isOwner || isMember;
  const canManageMembers = isAdmin || isPM;

  const variant = STATUS_VARIANT[project.status] ?? 'outline';

  return (
    <div
      className="card h-full flex flex-col"
      style={{
        boxShadow: 'var(--sh-1)',
        transition: 'box-shadow var(--dur) var(--ease), border-color var(--dur) var(--ease)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--sh-2)';
        e.currentTarget.style.borderColor = 'var(--line-2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--sh-1)';
        e.currentTarget.style.borderColor = 'var(--line)';
      }}
    >
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <h3
              className="truncate"
              style={{
                font: '500 var(--t-h3)/var(--lh-h3) var(--font-sans)',
                letterSpacing: 'var(--tr-h3)',
                color: 'var(--ink)',
                margin: 0,
              }}
            >
              {project.name}
            </h3>
          </div>
          <span className={`badge ${variant} dot`}>{STATUS_LABEL[project.status]}</span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {canView && (
            <button
              onClick={() => onView(project.id)}
              className="btn btn-ghost btn-icon btn-sm"
              title="Ver proyecto"
              aria-label="Ver proyecto"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          {canManageMembers && (
            <button
              onClick={() => onManageMembers(project)}
              className="btn btn-ghost btn-icon btn-sm"
              title="Gestionar miembros"
              aria-label="Gestionar miembros"
            >
              <Users className="w-4 h-4" />
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => onEdit(project)}
              className="btn btn-ghost btn-icon btn-sm"
              title="Editar proyecto"
              aria-label="Editar proyecto"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(project.id)}
              className="btn btn-ghost btn-icon btn-sm"
              title="Eliminar proyecto"
              aria-label="Eliminar proyecto"
              style={{ color: 'var(--err-fg)' }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="mb-3">
          <span className="badge info">Admin</span>
        </div>
      )}

      {project.description && (
        <p
          className="line-clamp-3 mb-4"
          style={{
            font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
            color: 'var(--ink-2)',
            margin: '0 0 var(--s-4)',
          }}
        >
          {project.description}
        </p>
      )}

      <div className="mt-auto" style={{ paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' }}>
        <div
          className="flex items-center gap-2 mb-2"
          style={{ font: '400 var(--t-caption)/1.3 var(--font-mono)', color: 'var(--ink-3)' }}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {formatDate(project.startDate)} — {formatDate(project.endDate)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5" style={{ font: '400 var(--t-small)/1 var(--font-sans)', color: 'var(--ink-2)' }}>
            <Users className="w-3.5 h-3.5" style={{ color: 'var(--ink-3)' }} />
            <span>{project.members.length} miembro{project.members.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1" style={{ font: '400 var(--t-caption)/1 var(--font-mono)', color: 'var(--ink-4)' }}>
            <Clock className="w-3 h-3" />
            <span className="truncate">{formatDate(project.updatedAt)}</span>
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
  onLoadMore,
}) => {
  const { user } = useAuth();
  const { isAdmin, isPM } = useUserRole();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

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
        <div className="flex justify-between items-center">
          <div className="h-8 rounded w-48 animate-pulse" style={{ background: 'var(--surface-3)' }} />
          <div className="h-10 rounded w-32 animate-pulse" style={{ background: 'var(--surface-3)' }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card h-64" data-testid="project-skeleton">
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--surface-3)' }} />
                  <div className="h-5 rounded w-3/4 animate-pulse" style={{ background: 'var(--surface-3)' }} />
                </div>
                <div className="h-4 rounded w-1/3 animate-pulse" style={{ background: 'var(--surface-3)' }} />
                <div className="flex-1 rounded animate-pulse" style={{ background: 'var(--surface-3)' }} />
                <div className="space-y-2">
                  <div className="h-3 rounded w-2/3 animate-pulse" style={{ background: 'var(--surface-3)' }} />
                  <div className="h-3 rounded w-1/2 animate-pulse" style={{ background: 'var(--surface-3)' }} />
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
      <div className="empty" role="alert">
        <div className="glyph">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 style={{ font: '500 var(--t-h3)/var(--lh-h3) var(--font-sans)', color: 'var(--ink)', margin: 0 }}>
          Error al cargar proyectos
        </h3>
        <p style={{ font: '400 var(--t-small)/var(--lh-small) var(--font-sans)', color: 'var(--ink-2)', margin: 'var(--s-2) 0 var(--s-5)' }}>
          {error}
        </p>
        <button onClick={() => window.location.reload()} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h2
            style={{
              font: '500 var(--t-h2)/var(--lh-h2) var(--font-sans)',
              letterSpacing: 'var(--tr-h2)',
              color: 'var(--ink)',
              margin: 0,
            }}
          >
            {isAdmin ? 'Todos los Proyectos' : 'Mis Proyectos'}
          </h2>
          <p
            style={{
              font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
              color: 'var(--ink-2)',
              margin: 'var(--s-1) 0 0',
            }}
          >
            {projects.length} proyecto{projects.length !== 1 ? 's' : ''} encontrado{projects.length !== 1 ? 's' : ''}
            {isAdmin && <span className="badge info ml-2">Vista de Administrador</span>}
          </p>
        </div>

        {canCreateProject && (
          <button onClick={onCreateProject} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            Nuevo Proyecto
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="empty">
          <div className="glyph">
            <FolderOpen className="w-7 h-7" />
          </div>
          <h3 style={{ font: '500 var(--t-h3)/var(--lh-h3) var(--font-sans)', color: 'var(--ink)', margin: '0 0 var(--s-2)' }}>
            No hay proyectos
          </h3>
          <p
            className="mx-auto"
            style={{
              font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
              color: 'var(--ink-2)',
              maxWidth: '52ch',
              margin: '0 auto var(--s-5)',
            }}
          >
            {canCreateProject
              ? 'Comienza creando tu primer proyecto para gestionar tareas y equipos de manera eficiente.'
              : 'No tienes acceso a ningún proyecto. Contacta con un administrador o PM para que te agregue a un proyecto.'}
          </p>
          {canCreateProject && (
            <button onClick={onCreateProject} className="btn btn-primary btn-lg">
              <Plus className="w-5 h-5" />
              Crear Primer Proyecto
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6" data-testid="projects-grid">
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

          {hasMore && (
            <div className="text-center pt-4">
              <button onClick={onLoadMore} disabled={loading} className="btn btn-secondary">
                {loading ? 'Cargando...' : 'Cargar Más Proyectos'}
              </button>
            </div>
          )}
        </>
      )}

      {selectedProject && (
        <MemberModal
          isOpen={memberModalOpen}
          onClose={closeMemberModal}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          isOwner={user?.uid === selectedProject.ownerId}
        />
      )}
    </div>
  );
};

export default ProjectList;
