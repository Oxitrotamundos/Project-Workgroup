import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import TopNavigation from './TopNavigation';

interface NavigationState {
  title: string;
  subtitle?: string;
  showLogo: boolean;
  showBackButton: boolean;
  backTo: string;
  actions?: React.ReactNode;
  logoSrc?: string;
  logoAlt?: string;
}

interface NavigationContextType {
  navigationState: NavigationState;
  updateNavigation: (state: Partial<NavigationState>) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const [navigationState, setNavigationState] = useState<NavigationState>({
    title: 'Project Workgroup',
    showLogo: false,
    showBackButton: false,
    backTo: '/dashboard'
  });

  // Actualiza el estado de navegación basado en la ruta actual
  useEffect(() => {
    const isDashboard = location.pathname === '/dashboard';
    const isProject = location.pathname.startsWith('/project/');

    if (isDashboard) {
      setNavigationState(prev => ({
        ...prev,
        title: 'Project Workgroup',
        subtitle: undefined, // Se actualizará por el componente Dashboard
        showLogo: true,
        showBackButton: false,
        actions: undefined,
        logoSrc: '/vite.svg',
        logoAlt: 'Project Workgroup Logo'
      }));
    } else if (isProject) {
      setNavigationState(prev => ({
        ...prev,
        title: prev.title, // Mantén el título actual hasta que se cargue el proyecto
        subtitle: undefined, // Limpia el subtítulo inmediatamente
        showLogo: false,
        showBackButton: true,
        backTo: '/dashboard',
        actions: undefined // Limpia las acciones hasta que se cargue el proyecto
      }));
    }
  }, [location.pathname]);

  const updateNavigation = useCallback((newState: Partial<NavigationState>) => {
    setNavigationState(prev => ({ ...prev, ...newState }));
  }, []);

  const contextValue = useMemo(() => ({
    navigationState,
    updateNavigation
  }), [navigationState, updateNavigation]);

  return (
    <NavigationContext.Provider value={contextValue}>
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
    </NavigationContext.Provider>
  );
};

export default AppLayout;