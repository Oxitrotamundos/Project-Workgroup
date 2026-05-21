import { useCallback, useMemo, useState } from 'react';
import type { NavigationState } from '../types/navigation';
import { DEFAULT_TITLES, ROUTES } from '../constants/navigation';

const DEFAULT_NAVIGATION_STATE: NavigationState = {
  title: DEFAULT_TITLES.APP_NAME,
  showBackButton: false,
  backTo: ROUTES.DASHBOARD,
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