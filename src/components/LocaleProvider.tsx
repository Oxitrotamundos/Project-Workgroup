import React, { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import coreLocaleEs from 'wx-core-locales/locales/es';
import ganttLocaleEs from '../locales/gantt-es';

// Contexto de localización
interface LocaleContextType {
  locale: string;
  translations: any;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'es',
  translations: {}
});

// Hook para usar la localización
export const useLocale = () => {
  return useContext(LocaleContext);
};

// Función para configurar la localización global
const setupGlobalWXLocale = (translations: any) => {
  if (typeof window !== 'undefined') {
    // Configurar wx global
    window.wx = window.wx || {};
    window.wx.locales = window.wx.locales || {};
    window.wx.locales['es'] = translations;
    window.wx.locale = 'es';

    // Variables adicionales que SVAR podría usar
    window.wxLocale = 'es';
    window.wxLocales = window.wx.locales;

    // Intentar configurar i18n si existe
    if (window.wx.i18n) {
      try {
        window.wx.i18n.setLocale('es');
        window.wx.i18n.setTranslations('es', translations);
      } catch (error) {
        console.warn('Error configurando wx.i18n:', error);
      }
    }

    // Configurar traducciones de manera que SVAR pueda accederlas
    if (window.wx.setLocale) {
      try {
        window.wx.setLocale('es', translations);
      } catch (error) {
        console.warn('Error configurando wx.setLocale:', error);
      }
    }

    console.log('LocaleProvider: Configuración global de WX completada');
  }
};

interface LocaleProviderProps {
  children: ReactNode;
  locale?: string;
}

export const LocaleProvider: React.FC<LocaleProviderProps> = ({
  children,
  locale = 'es'
}) => {
  // Combinar todas las traducciones
  const translations = React.useMemo(() => {
    return {
      ...coreLocaleEs,
      ...ganttLocaleEs
    };
  }, []);

  // Configurar la localización global cuando el componente se monta
  useEffect(() => {
    setupGlobalWXLocale(translations);

    // También intentar configurar después de un pequeño delay para asegurar que WX esté cargado
    const timeoutId = setTimeout(() => {
      setupGlobalWXLocale(translations);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [translations]);

  // Valor del contexto
  const contextValue = React.useMemo(() => ({
    locale,
    translations
  }), [locale, translations]);

  return (
    <LocaleContext.Provider value={contextValue}>
      {children}
    </LocaleContext.Provider>
  );
};

// Declaraciones globales para TypeScript
declare global {
  interface Window {
    wx?: any;
    wxLocale?: string;
    wxLocales?: any;
  }
}

export default LocaleProvider;