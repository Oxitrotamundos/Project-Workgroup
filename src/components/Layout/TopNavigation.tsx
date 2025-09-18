import React from 'react';
import { Link } from 'react-router-dom';
import UserProfile from './UserProfile';

interface TopNavigationProps {
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  backTo?: string;
  actions?: React.ReactNode;
}

const TopNavigation: React.FC<TopNavigationProps> = ({
  title = 'Project Workgroup',
  subtitle,
  showBackButton = false,
  backTo = '/dashboard',
  actions
}) => {
  return (
    <nav className="bg-white/95 backdrop-blur-sm border-b border-gray-200/60 sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Sección izquierda */}
          <div className="flex items-center space-x-4 min-w-0 flex-1">
            {showBackButton && (
              <Link
                to={backTo}
                className="flex items-center text-gray-500 hover:text-gray-700 transition-colors duration-200 shrink-0"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium hidden sm:inline">Volver</span>
              </Link>
            )}

            {showBackButton && <div className="h-6 w-px bg-gray-200 hidden sm:block" />}

            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-900 truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-gray-600 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Sección central - Acciones */}
          {actions && (
            <div className="flex items-center space-x-2 mx-4 shrink-0">
              {actions}
            </div>
          )}

          {/* Sección derecha - Usuario */}
          <div className="shrink-0">
            <UserProfile />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default TopNavigation;