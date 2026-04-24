import { useAppVersion } from '../../hooks/useAppVersion';

export interface VersionBadgeProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
  showTooltip?: boolean;
}

/**
 * Componente de insignia de versión en posición fija
 */
export function VersionBadge({
  position = 'bottom-right',
  className = '',
  showTooltip = true,
}: VersionBadgeProps) {
  const { versionWithPrefix, major, minor, patch, name } = useAppVersion();

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  const tooltipText = showTooltip
    ? `${name}\nVersion: ${versionWithPrefix}\nMajor: ${major}, Minor: ${minor}, Patch: ${patch}`
    : undefined;

  return (
    <div
      className={`fixed ${positionClasses[position]} z-50 ${className}`}
      title={tooltipText}
    >
      <span className="inline-flex items-center rounded-md bg-gray-800/80 px-2 py-1 text-xs font-medium text-white shadow-lg backdrop-blur-sm dark:bg-gray-700/80">
        {versionWithPrefix}
      </span>
    </div>
  );
}
