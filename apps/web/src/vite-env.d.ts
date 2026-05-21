/// <reference types="vite/client" />

declare global {
  const __APP_VERSION__: string;
  const __APP_NAME__: string;

  interface Window {
    wx?: {
      locales?: Record<string, Record<string, unknown>>;
      locale?: string;
      i18n?: {
        setLocale: (locale: string) => void;
        setTranslations?: (locale: string, translations: Record<string, unknown>) => void;
      };
      setLocale?: (locale: string, translations: Record<string, unknown>) => void;
    };
    wxLocale?: string;
    wxLocales?: Record<string, Record<string, unknown>>;
  }
}

export {};
