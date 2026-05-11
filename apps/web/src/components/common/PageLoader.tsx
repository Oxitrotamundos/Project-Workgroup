import React, { memo, useState, useCallback } from 'react';
import RiveLoader from './RiveLoader';

interface PageLoaderProps {
  message?: string;
  overlay?: boolean;
  onAnimationComplete?: () => void;
}

const PageLoader: React.FC<PageLoaderProps> = memo(({
  message = 'Cargando...',
  overlay = false,
  onAnimationComplete
}) => {
  const [shouldHide, setShouldHide] = useState(false);

  const handleAnimationComplete = useCallback(() => {
    setShouldHide(true);

    setTimeout(() => {
      onAnimationComplete?.();
    }, 300);
  }, [onAnimationComplete]);

  const containerClasses = overlay
    ? 'fixed inset-0 backdrop-blur-sm z-50'
    : 'min-h-screen';

  const fadeClasses = shouldHide
    ? 'opacity-0 transform scale-95 transition-all duration-300 ease-out'
    : 'opacity-100 transform scale-100 transition-all duration-200 ease-in';

  return (
    <div
      className={`${containerClasses} flex items-center justify-center ${fadeClasses}`}
      style={overlay
        ? { background: 'color-mix(in oklab, var(--bg) 90%, transparent)' }
        : { background: 'var(--bg)' }}
    >
      <div className="text-center">
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