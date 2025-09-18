import React from 'react';
import { Link } from 'react-router-dom';
import UserProfile from './UserProfile';

interface TopNavigationProps {
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  backTo?: string;
  actions?: React.ReactNode;
  showLogo?: boolean;
  logoSrc?: string;
  logoAlt?: string;
}

const TopNavigation: React.FC<TopNavigationProps> = ({
  title = 'Project Workgroup',
  subtitle,
  showBackButton = false,
  backTo = '/dashboard',
  actions,
  showLogo = false,
  logoSrc = '/vite.svg',
  logoAlt = 'Logo'
}) => {
  return (
    <nav className="bg-white/95 backdrop-blur-sm border-b border-gray-200/60 sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Sección izquierda */}
          <div className="flex items-center space-x-4 min-w-0 flex-1">
            {/* Logo - Animado */}
            <div className="flex items-center shrink-0">
              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  showLogo ? 'w-8 sm:w-10 opacity-100' : 'w-0 opacity-0'
                }`}
              >
                <img
                  src={logoSrc}
                  alt={logoAlt}
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                />
              </div>

              {/* Separador animado */}
              <div
                className={`transition-all duration-300 ease-in-out h-6 bg-gray-200 hidden sm:block ${
                  showLogo ? 'w-px ml-4 opacity-100' : 'w-0 ml-0 opacity-0'
                }`}
              />
            </div>

            {/* Botón volver - Animado */}
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                showBackButton ? 'w-auto opacity-100' : 'w-0 opacity-0'
              }`}
            >
              <Link
                to={backTo}
                className="flex items-center text-gray-500 hover:text-gray-700 transition-colors duration-200 shrink-0 whitespace-nowrap"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium hidden sm:inline">Volver</span>
              </Link>
            </div>

            {/* Separador para botón volver */}
            <div
              className={`transition-all duration-300 ease-in-out h-6 bg-gray-200 hidden sm:block ${
                showBackButton ? 'w-px opacity-100' : 'w-0 opacity-0'
              }`}
            />

            {/* Título - Animado */}
            <div className="min-w-0 flex-1 transition-all duration-300 ease-in-out">
              <h1 className="text-xl font-bold text-gray-900 truncate transform transition-all duration-300">
                {title}
              </h1>
              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  subtitle ? 'max-h-6 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="text-sm text-gray-600 truncate">
                  {subtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Sección central - Acciones */}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              actions ? 'w-auto opacity-100 mx-4' : 'w-0 opacity-0 mx-0'
            } shrink-0`}
          >
            <div className="flex items-center space-x-2">
              {actions}
            </div>
          </div>

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