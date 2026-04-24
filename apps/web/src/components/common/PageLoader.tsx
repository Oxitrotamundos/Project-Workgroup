import React, { memo, useState, useCallback } from 'react';
import RiveLoader from './RiveLoader';

interface PageLoaderProps {
  message?: string;
  overlay?: boolean;
  onAnimationComplete?: () => void;
}

/**
 * Componente de loader de página completa
 * Usa eventos reales de Rive para detectar final de animación
 */
const PageLoader: React.FC<PageLoaderProps> = memo(({
  message = 'Cargando...',
  overlay = false,
  onAnimationComplete
}) => {
  const [shouldHide, setShouldHide] = useState(false);

  const handleAnimationComplete = useCallback(() => {
    setShouldHide(true);

    // Pequeño delay para la transición de salida
    setTimeout(() => {
      onAnimationComplete?.();
    }, 300);
  }, [onAnimationComplete]);

  const containerClasses = overlay
    ? 'fixed inset-0 bg-white/90 backdrop-blur-sm z-50'
    : 'min-h-screen bg-gray-50';

  // Transición de salida suave
  const fadeClasses = shouldHide
    ? 'opacity-0 transform scale-95 transition-all duration-300 ease-out'
    : 'opacity-100 transform scale-100 transition-all duration-200 ease-in';

  return (
    <div className={`${containerClasses} flex items-center justify-center ${fadeClasses}`}>
      <div className="text-center">
        {/* Loader Rive con callback real */}
        <RiveLoader
          size="lg"
          message={message}
          className="mb-4"
          onAnimationComplete={handleAnimationComplete}
        />
      </div>
    </div>
  );
});

PageLoader.displayName = 'PageLoader';

export default PageLoader;