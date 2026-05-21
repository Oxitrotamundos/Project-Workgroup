import React from 'react';
import type { ProjectSettingsResponse, TimeGranularity } from '@project-workgroup/shared';

interface Value {
  settings: ProjectSettingsResponse | null;
  timeGranularity: TimeGranularity;
  isDays: boolean;
}

const Ctx = React.createContext<Value>({
  settings: null,
  timeGranularity: 'hours',
  isDays: false,
});

interface ProviderProps {
  settings: ProjectSettingsResponse | null | undefined;
  children: React.ReactNode;
}

export const ProjectSettingsProvider: React.FC<ProviderProps> = ({ settings, children }) => {
  const timeGranularity: TimeGranularity = settings?.timeGranularity ?? 'hours';
  const value = React.useMemo(
    () => ({
      settings: settings ?? null,
      timeGranularity,
      isDays: timeGranularity === 'days',
    }),
    [settings, timeGranularity],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useProjectSettings = (): Value => React.useContext(Ctx);
