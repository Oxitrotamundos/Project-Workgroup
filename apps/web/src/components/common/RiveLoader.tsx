import React, { memo, useEffect } from 'react';
import { useRive } from '@rive-app/react-canvas';

interface RiveLoaderProps {
  className?: string;
  message?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onAnimationComplete?: () => void;
}

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
  xl: 'w-48 h-48'
};

/**
 * Componente de loader animado usando Rive
 * Optimizado para performance con React.memo
 */
const RiveLoader: React.FC<RiveLoaderProps> = memo(({
  className = '',
  message = 'Cargando...',
  size = 'md',
  onAnimationComplete
}) => {
  const { RiveComponent, rive } = useRive({
    src: '/untitled.riv',
    autoplay: true,
    onLoad: () => {
      // Acelerar la animación 25x para que dure menos tiempo
      if (rive) {
        (rive as any).speed = 25.0;
      }
    },
    onLoop: () => {
      // Llamar al callback cuando la animación complete un ciclo
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    },
    onLoadError: (error) => {
      console.error('RiveLoader: Failed to load animation:', error);
    }
  });

  // Fallback en caso de que onLoop no se dispare (por si la animación no es loop)
  useEffect(() => {
    if (rive && onAnimationComplete) {
      // Fallback de 1.5 segundos - tiempo optimizado basado en velocidad 25x
      const fallbackTimer = setTimeout(() => {
        onAnimationComplete();
      }, 1500);

      return () => {
        clearTimeout(fallbackTimer);
      };
    }
  }, [rive, onAnimationComplete]);

  return (
    <div className={`flex flex-col items-center justify-center space-y-4 ${className}`}>
      {/* Animación Rive */}
      <div className={`${sizeClasses[size]} flex items-center justify-center`}>
        <RiveComponent className="w-full h-full" />
      </div>

      {/* Mensaje de carga */}
      {message && (
        <p className="text-sm text-gray-600 font-medium animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
});

RiveLoader.displayName = 'RiveLoader';

export default RiveLoader;