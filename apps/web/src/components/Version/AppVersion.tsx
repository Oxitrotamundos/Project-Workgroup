import { useAppVersion } from '../../hooks/useAppVersion';

export interface AppVersionProps {
  showPrefix?: boolean;
  className?: string;
  badge?: boolean;
  showAppName?: boolean;
}

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
      <span className={`badge info ${className}`}>{displayText}</span>
    );
  }

  return <span className={className}>{displayText}</span>;
}
