export function installWxGlobals(translations: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  const wx = (window.wx ??= {});
  wx.locales ??= {};
  wx.locales['es'] = translations;
  wx.locale = 'es';

  window.wxLocale = 'es';
  window.wxLocales = wx.locales;

  if (wx.i18n) {
    wx.i18n.setLocale('es');
    wx.i18n.setTranslations?.('es', translations);
  }

  wx.setLocale?.('es', translations);
}
