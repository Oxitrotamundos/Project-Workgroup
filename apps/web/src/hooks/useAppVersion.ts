import { useMemo } from 'react';

export interface AppVersionInfo {
  version: string;
  name: string;
  major: number;
  minor: number;
  patch: number;
  versionWithPrefix: string;
}

/**
 * Hook para acceder a la información de versión de la aplicación
 */
export function useAppVersion(): AppVersionInfo {
  const versionInfo = useMemo(() => {
    const version = __APP_VERSION__;
    const name = __APP_NAME__;

    // Parseo de versión semántica
    const versionParts = version.split('.');
    const major = parseInt(versionParts[0] || '0', 10);
    const minor = parseInt(versionParts[1] || '0', 10);
    const patch = parseInt(versionParts[2] || '0', 10);

    return {
      version,
      name,
      major,
      minor,
      patch,
      versionWithPrefix: `v${version}`,
    };
  }, []);

  return versionInfo;
}

export function getAppVersion(): string {
  return __APP_VERSION__;
}

export function getAppName(): string {
  return __APP_NAME__;
}
