import React, { memo } from 'react';
import RiveLoader from './RiveLoader';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  center?: boolean;
  className?: string;
}

/**
 * Componente de spinner de carga usando Rive
 * Para uso en componentes específicos o secciones
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = memo(({
  message,
  size = 'sm',
  center = true,
  className = ''
}) => {
  const containerClasses = center
    ? 'flex items-center justify-center'
    : 'flex items-start';

  return (
    <div className={`${containerClasses} ${className}`}>
      <RiveLoader
        size={size}
        message={message}
      />
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;