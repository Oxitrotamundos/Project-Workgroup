import React, { createContext, useContext } from 'react';
import type { NavigationState } from '../types/navigation';

interface NavigationContextType {
  navigationState: NavigationState;
  updateNavigation: (state: Partial<NavigationState>) => void;
  resetNavigation: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error(
      'useNavigation must be used within a NavigationProvider. ' +
      'Wrap your component tree with <NavigationProvider>.'
    );
  }
  return context;
};

interface NavigationProviderProps {
  children: React.ReactNode;
  value: NavigationContextType;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({
  children,
  value
}) => {
  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export default NavigationContext;