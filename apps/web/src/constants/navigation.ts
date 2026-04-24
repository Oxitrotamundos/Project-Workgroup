/**
 * Constantes para la navegación de la aplicación
 */

// Rutas de la aplicación
export const ROUTES = {
  DASHBOARD: '/dashboard',
  PROJECT: '/project',
  LOGIN: '/login',
  SIGNUP: '/signup'
} as const;

// Configuración de logos
export const LOGO_CONFIG = {
  DEFAULT_SRC: '/vite.svg',
  DEFAULT_ALT: 'Project Workgroup Logo',
  SIZES: {
    SMALL: 'w-8 h-8',
    MEDIUM: 'w-10 h-10'
  }
} as const;

// Duraciones de animación
export const ANIMATION_DURATIONS = {
  FAST: 200,
  MEDIUM: 300,
  SLOW: 500
} as const;

// Títulos por defecto
export const DEFAULT_TITLES = {
  APP_NAME: 'Project Workgroup',
  LOADING: 'Cargando...',
  ERROR: 'Error'
} as const;

// Clases CSS reutilizables
export const CSS_CLASSES = {
  TRANSITION_ALL: 'transition-all duration-300 ease-in-out',
  BUTTON_BASE: 'flex items-center transition-colors duration-150',
  DROPDOWN_ITEM: 'flex items-center w-full px-4 py-2 text-sm transition-colors duration-150'
} as const;