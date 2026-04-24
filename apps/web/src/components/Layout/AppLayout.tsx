import React from 'react';
import { NavigationProvider } from '../../contexts/NavigationContext';
import { useNavigationState } from '../../hooks/useNavigationState';
import { useRouteNavigation } from '../../hooks/useRouteNavigation';
import TopNavigation from './TopNavigation';

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout principal de la aplicación con navegación persistente
 * Proporciona contexto de navegación y maneja transiciones entre rutas
 */
const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const navigationContext = useNavigationState();
  const { navigationState, updateNavigation } = navigationContext;

  // Maneja cambios de navegación basados en rutas
  useRouteNavigation(updateNavigation);

  return (
    <NavigationProvider value={navigationContext}>
      <div className="min-h-screen bg-gray-50">
        {/* Barra de navegación persistente */}
        <TopNavigation
          title={navigationState.title}
          subtitle={navigationState.subtitle}
          showBackButton={navigationState.showBackButton}
          backTo={navigationState.backTo}
          actions={navigationState.actions}
          showLogo={navigationState.showLogo}
          logoSrc={navigationState.logoSrc}
          logoAlt={navigationState.logoAlt}
        />

        {/* Contenido de la página */}
        <main className="transition-all duration-300 ease-in-out">
          {children}
        </main>
      </div>
    </NavigationProvider>
  );
};

export default AppLayout;