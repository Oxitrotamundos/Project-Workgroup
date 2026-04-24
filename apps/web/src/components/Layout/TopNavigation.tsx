import React, { memo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { TopNavigationProps } from '../../types/navigation';
import { DEFAULT_TITLES, ROUTES, LOGO_CONFIG } from '../../constants/navigation';
import UserProfile from './UserProfile';

/**
 * Componente de navegación superior con transiciones animadas
 * Optimizado para performance con React.memo
 */
const TopNavigation: React.FC<TopNavigationProps> = memo(({
  title = DEFAULT_TITLES.APP_NAME,
  subtitle,
  showBackButton = false,
  backTo = ROUTES.DASHBOARD,
  actions,
  showLogo = false,
  logoSrc = LOGO_CONFIG.DEFAULT_SRC,
  logoAlt = LOGO_CONFIG.DEFAULT_ALT
}) => {
  // Agregar estilos CSS para animaciones suaves
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInSlide {
        0% {
          opacity: 0;
          transform: translateY(-4px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .title-transition-enter {
        animation: fadeInSlide 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
      }
    `;

    if (!document.querySelector('#navigation-animations')) {
      style.id = 'navigation-animations';
      document.head.appendChild(style);
    }

    return () => {
      const existingStyle = document.querySelector('#navigation-animations');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);

  return (
    <nav
      className="bg-white/95 backdrop-blur-sm border-b border-gray-200/60 sticky top-0 z-50"
      role="navigation"
      aria-label="Navegación principal"
    >
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
                aria-label="Volver a la página anterior"
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

            {/* Título - Animado con transición suave */}
            <div className="min-w-0 flex-1 relative overflow-hidden">
              <div className="transition-all duration-400 ease-out">
                <h1
                  className="text-xl font-bold text-gray-900 truncate title-transition-enter"
                  id="page-title"
                  key={title}
                >
                  {title}
                </h1>
              </div>
              <div
                className={`transition-all duration-400 ease-out overflow-hidden ${
                  subtitle ? 'max-h-6 opacity-100 mt-1' : 'max-h-0 opacity-0 mt-0'
                }`}
              >
                {subtitle && (
                  <p
                    className="text-sm text-gray-600 truncate title-transition-enter"
                    key={subtitle}
                  >
                    {subtitle}
                  </p>
                )}
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
});

TopNavigation.displayName = 'TopNavigation';

export default TopNavigation;