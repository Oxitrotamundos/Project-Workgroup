import React from 'react';
import { NavigationProvider } from '../../contexts/NavigationContext';
import { useNavigationState } from '../../hooks/useNavigationState';
import { useRouteNavigation } from '../../hooks/useRouteNavigation';
import TopNavigation from './TopNavigation';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const navigationContext = useNavigationState();
  const { navigationState, updateNavigation } = navigationContext;

  useRouteNavigation(updateNavigation);

  return (
    <NavigationProvider value={navigationContext}>
      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink-1)' }}>
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

        <main className="transition-all">
          {children}
        </main>
      </div>
    </NavigationProvider>
  );
};

export default AppLayout;
