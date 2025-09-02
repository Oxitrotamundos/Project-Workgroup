import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Users } from 'lucide-react';
import type { Project } from '../types/firestore';

interface ProjectHeaderProps {
  project: Project;
  tasksCount: number;
  onViewTeam?: () => void;
  onChangeView?: () => void;
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project,
  tasksCount,
  onViewTeam,
  onChangeView
}) => {
  const navigate = useNavigate();

  return (
    <>
      {/* Header minimalista */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center text-gray-500 hover:text-gray-700 transition-all duration-200 hover:scale-105"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Volver</span>
              </button>
              <div className="h-4 w-px bg-gray-200"></div>
              <div className="flex items-center space-x-3">
                <h1 className="text-lg font-semibold text-gray-800">{project.name}</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button 
                onClick={onChangeView}
                className="flex items-center px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-all duration-200"
              >
                <Calendar className="w-3.5 h-3.5 mr-1.5" />
                Vista
              </button>
              <button 
                onClick={onViewTeam}
                className="flex items-center px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-all duration-200"
              >
                <Users className="w-3.5 h-3.5 mr-1.5" />
                Equipo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info compacta del proyecto */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 truncate max-w-2xl">{project.description}</p>
            <div className="flex items-center space-x-6 text-xs text-gray-500">
              <span className="flex items-center">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2"></span>
                {project.status}
              </span>
              <span>{project.members.length} miembros</span>
              <span>{tasksCount} tareas</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProjectHeader;