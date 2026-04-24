import { useAppVersion } from '../../hooks/useAppVersion';

export interface AppVersionProps {
  showPrefix?: boolean;
  className?: string;
  badge?: boolean;
  showAppName?: boolean;
}

/**
 * Componente para mostrar la versión de la aplicación
 */
export function AppVersion({
  showPrefix = true,
  className = '',
  badge = false,
  showAppName = false,
}: AppVersionProps) {
  const { version, versionWithPrefix, name } = useAppVersion();

  const displayVersion = showPrefix ? versionWithPrefix : version;
  const displayText = showAppName ? `${name} ${displayVersion}` : displayVersion;

  if (badge) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200 ${className}`}
      >
        {displayText}
      </span>
    );
  }

  return <span className={className}>{displayText}</span>;
}
