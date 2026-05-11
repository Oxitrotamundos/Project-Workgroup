import { useAppVersion } from '../../hooks/useAppVersion';

export interface VersionBadgeProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
  showTooltip?: boolean;
}

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
      <span
        className="inline-flex items-center backdrop-blur-sm"
        style={{
          background: 'color-mix(in oklab, var(--ink-1) 80%, transparent)',
          color: 'var(--surface)',
          font: '500 var(--t-caption)/1 var(--font-mono)',
          padding: '4px 8px',
          borderRadius: 'var(--r-sm)',
          boxShadow: 'var(--sh-2)',
        }}
      >
        {versionWithPrefix}
      </span>
    </div>
  );
}
