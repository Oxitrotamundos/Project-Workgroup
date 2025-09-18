import { useCallback, useMemo, useState } from 'react';
import type { NavigationState } from '../types/navigation';
import { DEFAULT_TITLES, ROUTES, LOGO_CONFIG } from '../constants/navigation';

const DEFAULT_NAVIGATION_STATE: NavigationState = {
  title: DEFAULT_TITLES.APP_NAME,
  showLogo: false,
  showBackButton: false,
  backTo: ROUTES.DASHBOARD,
  logoSrc: LOGO_CONFIG.DEFAULT_SRC,
  logoAlt: LOGO_CONFIG.DEFAULT_ALT
};

export const useNavigationState = (initialState?: Partial<NavigationState>) => {
  const [navigationState, setNavigationState] = useState<NavigationState>({
    ...DEFAULT_NAVIGATION_STATE,
    ...initialState
  });

  const updateNavigation = useCallback((newState: Partial<NavigationState>) => {
    setNavigationState(prev => ({ ...prev, ...newState }));
  }, []);

  const resetNavigation = useCallback(() => {
    setNavigationState(DEFAULT_NAVIGATION_STATE);
  }, []);

  const contextValue = useMemo(() => ({
    navigationState,
    updateNavigation,
    resetNavigation
  }), [navigationState, updateNavigation, resetNavigation]);

  return contextValue;
};