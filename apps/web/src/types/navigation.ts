/**
 * Tipos TypeScript para el sistema de navegación
 */

export interface Crumb {
  label: string;
  to?: string;
}

export interface NavigationState {
  title: string;
  subtitle?: string;
  crumbs?: Crumb[];
  showBackButton: boolean;
  backTo: string;
  actions?: React.ReactNode;
}

export interface NavigationContextType {
  navigationState: NavigationState;
  updateNavigation: (state: Partial<NavigationState>) => void;
  resetNavigation: () => void;
}

export interface TopNavigationProps {
  title?: string;
  subtitle?: string;
  crumbs?: Crumb[];
  showBackButton?: boolean;
  backTo?: string;
  actions?: React.ReactNode;
}

export interface UserProfileProps {
  className?: string;
}

export interface ProjectActionsProps {
  onOpenCalendar?: () => void;
  className?: string;
}

// Tipos de eventos de menú
export type MenuAction = 'profile' | 'settings' | 'logout';

// Tipos de rutas válidas
export type AppRoute = '/dashboard' | '/project' | '/login' | '/signup';

// Configuración de ruta
export interface RouteConfig {
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  backTo?: string;
  requiresAuth?: boolean;
}