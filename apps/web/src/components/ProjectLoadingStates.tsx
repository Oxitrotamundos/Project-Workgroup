import React from 'react';
import { useNavigate } from 'react-router-dom';

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

export const LoadingState: React.FC<LoadingStateProps> = ({ 
  message = 'Cargando proyecto...' 
}) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">{message}</p>
      </div>
    </div>
  );
};

export const ErrorState: React.FC<ErrorStateProps> = ({ 
  error, 
  onRetry 
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onRetry && (
            <button
              onClick={onRetry}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reintentar
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export const NotFoundState: React.FC<NotFoundStateProps> = ({ 
  title = 'Proyecto no encontrado',
  message = 'El proyecto que buscas no existe o no tienes acceso a él.'
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-gray-400 text-6xl mb-4">📁</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Volver al Dashboard
        </button>
      </div>
    </div>
  );
};

// Componente compuesto para manejar todos los estados
interface ProjectStateManagerProps {
  loading: boolean;
  error: string | null;
  project: any | null;
  children: React.ReactNode;
  onRetry?: () => void;
}

export const ProjectStateManager: React.FC<ProjectStateManagerProps> = ({
  loading,
  error,
  project,
  children,
  onRetry
}) => {
  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  if (!project) {
    return <NotFoundState />;
  }

  return <>{children}</>;
};

export default ProjectStateManager;