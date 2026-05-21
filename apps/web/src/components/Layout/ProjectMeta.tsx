import React from 'react';
import type { Project } from '../../types/domain';

interface ProjectMetaProps {
  project: Project;
  tasksCount?: number;
}

const STATUS_VARIANT: Record<string, 'ok' | 'info' | 'warn' | 'err' | 'outline'> = {
  active: 'ok',
  activo: 'ok',
  planning: 'info',
  completed: 'info',
  completado: 'info',
  paused: 'warn',
  pausado: 'warn',
  cancelled: 'err',
  cancelado: 'err',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Activo',
  planning: 'Planificación',
  completed: 'Completado',
  paused: 'Pausado',
  cancelled: 'Cancelado',
};

const formatStatus = (status: string) =>
  STATUS_LABEL[status.toLowerCase()] || status;

const ProjectMeta: React.FC<ProjectMetaProps> = ({ project, tasksCount }) => {
  const status = project.status || 'planning';
  const variant = STATUS_VARIANT[status.toLowerCase()] ?? 'outline';
  const memberCount = project.members?.length ?? 0;

  return (
    <div
      className="flex items-center gap-3"
      style={{ font: '400 var(--t-caption)/1 var(--font-mono)', color: 'var(--ink-3)' }}
    >
      <span className={`badge ${variant} dot`}>{formatStatus(status)}</span>

      {typeof tasksCount === 'number' && (
        <span className="hidden md:inline whitespace-nowrap">
          <span style={{ color: 'var(--ink-1)', fontWeight: 500 }}>{tasksCount}</span>{' '}
          {tasksCount === 1 ? 'tarea' : 'tareas'}
        </span>
      )}

      <span className="hidden lg:inline whitespace-nowrap">
        <span style={{ color: 'var(--ink-1)', fontWeight: 500 }}>{memberCount}</span>{' '}
        {memberCount === 1 ? 'miembro' : 'miembros'}
      </span>
    </div>
  );
};

export default ProjectMeta;
