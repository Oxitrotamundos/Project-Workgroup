// Declaraciones de tipos para los módulos de localización de SVAR

declare module 'wx-core-locales/locales/es' {
  interface CoreLocale {
    core: {
      ok: string;
      cancel: string;
      select: string;
      "No data": string;
      "Rows per page": string;
      "Total pages": string;
    };
    calendar: {
      monthFull: string[];
      monthShort: string[];
      dayFull: string[];
      dayShort: string[];
      hours: string;
      minutes: string;
      done: string;
      clear: string;
      today: string;
      weekStart: number;
      clockFormat: number;
    };
    formats: {
      timeFormat: string;
      dateFormat: string;
      monthYearFormat: string;
      yearFormat: string;
    };
    lang: string;
  }

  const coreLocaleEs: CoreLocale;
  export default coreLocaleEs;
}

declare module 'wx-gantt-locales/locales/es' {
  interface GanttLocale {
    gantt: {
      [key: string]: string;
    };
  }

  const ganttLocaleEs: GanttLocale;
  export default ganttLocaleEs;
}

declare module 'wx-core-locales/locales/en' {
  interface CoreLocale {
    core: {
      ok: string;
      cancel: string;
      select: string;
      "No data": string;
      "Rows per page": string;
      "Total pages": string;
    };
    calendar: {
      monthFull: string[];
      monthShort: string[];
      dayFull: string[];
      dayShort: string[];
      hours: string;
      minutes: string;
      done: string;
      clear: string;
      today: string;
      weekStart: number;
      clockFormat: number;
    };
    formats: {
      timeFormat: string;
      dateFormat: string;
      monthYearFormat: string;
      yearFormat: string;
    };
    lang: string;
  }

  const coreLocaleEn: CoreLocale;
  export default coreLocaleEn;
}

declare module 'wx-gantt-locales/locales/en' {
  interface GanttLocale {
    gantt: {
      [key: string]: string;
    };
  }

  const ganttLocaleEn: GanttLocale;
  export default ganttLocaleEn;
}