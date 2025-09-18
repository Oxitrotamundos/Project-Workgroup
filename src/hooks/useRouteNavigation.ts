import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { NavigationState } from '../types/navigation';

interface RouteNavigationConfig {
  [route: string]: Partial<NavigationState>;
}

const ROUTE_CONFIGS: RouteNavigationConfig = {
  '/dashboard': {
    title: 'Project Workgroup',
    subtitle: undefined,
    showLogo: true,
    showBackButton: false,
    actions: undefined,
    logoSrc: '/vite.svg',
    logoAlt: 'Project Workgroup Logo'
  },
  '/project': {
    title: undefined, // El título se establecerá por el componente de proyecto
    subtitle: undefined,
    showLogo: false,
    showBackButton: true,
    backTo: '/dashboard',
    actions: undefined
  }
};

export const useRouteNavigation = (
  updateNavigation: (state: Partial<NavigationState>) => void
) => {
  const location = useLocation();

  useEffect(() => {
    const isDashboard = location.pathname === '/dashboard';
    const isProject = location.pathname.startsWith('/project/');

    if (isDashboard) {
      updateNavigation(ROUTE_CONFIGS['/dashboard']);
    } else if (isProject) {
      updateNavigation(ROUTE_CONFIGS['/project']);
    }
  }, [location.pathname, updateNavigation]);

  return { currentPath: location.pathname };
};