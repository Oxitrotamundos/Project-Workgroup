import React, { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import coreLocaleEs from 'wx-core-locales/locales/es';
import ganttLocaleEs from '../locales/gantt-es';
import { installWxGlobals } from '../utils/wxGlobals';

interface LocaleContextType {
  locale: string;
  translations: Record<string, unknown>;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'es',
  translations: {},
});

export const useLocale = () => useContext(LocaleContext);

interface LocaleProviderProps {
  children: ReactNode;
  locale?: string;
}

export const LocaleProvider: React.FC<LocaleProviderProps> = ({
  children,
  locale = 'es',
}) => {
  const translations = React.useMemo(
    () => ({ ...coreLocaleEs, ...ganttLocaleEs }),
    [],
  );

  useEffect(() => {
    installWxGlobals(translations);
  }, [translations]);

  const contextValue = React.useMemo(
    () => ({ locale, translations }),
    [locale, translations],
  );

  return (
    <LocaleContext.Provider value={contextValue}>
      {children}
    </LocaleContext.Provider>
  );
};

export default LocaleProvider;
