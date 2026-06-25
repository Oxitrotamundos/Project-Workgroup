import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, FolderX } from 'lucide-react';
import type { Project } from '../types/domain';

interface LoadingStateProps {
  message?: string;
}

interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
}

interface NotFoundStateProps {
  title?: string;
  message?: string;
}

const containerStyle: React.CSSProperties = {
  minHeight: '60vh',
  background: 'var(--bg)',
};

const headingStyle: React.CSSProperties = {
  font: '500 var(--t-h2)/var(--lh-h2) var(--font-sans)',
  letterSpacing: 'var(--tr-h2)',
  color: 'var(--ink)',
  margin: '0 0 var(--s-2)',
};

const subStyle: React.CSSProperties = {
  font: '400 var(--t-small)/var(--lh-small) var(--font-sans)',
  color: 'var(--ink-2)',
  margin: '0 0 var(--s-5)',
};

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Cargando proyecto...' }) => (
  <div style={containerStyle} className="flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="w-10 h-10 animate-spin mx-auto" style={{ color: 'var(--p-500)' }} />
      <p style={{ ...subStyle, marginTop: 'var(--s-4)' }}>{message}</p>
    </div>
  </div>
);

export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  const navigate = useNavigate();
  return (
    <div style={containerStyle} className="flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--err-fg)' }} />
        <h2 style={headingStyle}>Error</h2>
        <p style={subStyle}>{error}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onRetry && (
            <button onClick={onRetry} className="btn btn-primary">
              Reintentar
            </button>
          )}
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
            Volver al Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export const NotFoundState: React.FC<NotFoundStateProps> = ({
  title = 'Proyecto no encontrado',
  message = 'El proyecto que buscas no existe o no tienes acceso a él.',
}) => {
  const navigate = useNavigate();
  return (
    <div style={containerStyle} className="flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <FolderX className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--ink-3)' }} />
        <h2 style={headingStyle}>{title}</h2>
        <p style={subStyle}>{message}</p>
        <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
          Volver al Dashboard
        </button>
      </div>
    </div>
  );
};

interface ProjectStateManagerProps {
  loading: boolean;
  error: string | null;
  project: Project | null;
  children: React.ReactNode;
  onRetry?: () => void;
}

export const ProjectStateManager: React.FC<ProjectStateManagerProps> = ({
  loading,
  error,
  project,
  children,
  onRetry,
}) => {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (!project) return <NotFoundState />;
  return <>{children}</>;
};

export default ProjectStateManager;
