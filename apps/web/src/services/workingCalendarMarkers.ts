import type {
  WorkingCalendarResponse,
  WorkingDayPatternResponse,
  HolidayResponse,
} from '@project-workgroup/shared';

export type HighlightTimeFn = (date: Date, unit: string) => string;

const NON_WORKING_CSS = 'wx-non-working';
const HOLIDAY_CSS = 'wx-holiday';

const parseTimeToMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parts = value.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const patternByWeekday = (
  patterns: WorkingDayPatternResponse[] | undefined,
): Map<number, WorkingDayPatternResponse> => {
  const map = new Map<number, WorkingDayPatternResponse>();
  if (!patterns) return map;
  for (const p of patterns) {
    map.set(p.weekday, p);
  }
  return map;
};

type HolidayIndex = {
  fixed: Set<string>;
  recurring: Set<string>;
};

const buildHolidayIndex = (holidays: HolidayResponse[] | undefined): HolidayIndex => {
  const fixed = new Set<string>();
  const recurring = new Set<string>();
  if (!holidays) return { fixed, recurring };
  for (const h of holidays) {
    // h.date llega como ISO date string ("YYYY-MM-DD" o full ISO).
    const ymd = h.date.length >= 10 ? h.date.slice(0, 10) : h.date;
    if (h.recurringYearly) {
      recurring.add(ymd.slice(5, 10));
    } else {
      fixed.add(ymd);
    }
  }
  return { fixed, recurring };
};

const formatYmd = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isHoliday = (date: Date, index: HolidayIndex): boolean => {
  const ymd = formatYmd(date);
  if (index.fixed.has(ymd)) return true;
  if (index.recurring.has(ymd.slice(5))) return true;
  return false;
};

export function createHighlightTime(
  calendar: WorkingCalendarResponse | null,
): HighlightTimeFn {
  if (!calendar) return () => '';

  const patterns = patternByWeekday(calendar.patterns);
  const holidayIndex = buildHolidayIndex(calendar.holidays);

  return (date: Date, unit: string): string => {
    if (unit !== 'day' && unit !== 'hour') return '';

    if (isHoliday(date, holidayIndex)) return HOLIDAY_CSS;

    const weekday = date.getDay(); // 0=Domingo, 6=Sábado
    const pattern = patterns.get(weekday);

    if (!pattern || !pattern.enabled) return NON_WORKING_CSS;

    if (unit === 'day') return '';

    const minutes = date.getHours() * 60 + date.getMinutes();
    const dayStart = parseTimeToMinutes(pattern.dayStart);
    const dayEnd = parseTimeToMinutes(pattern.dayEnd);
    const breakStart = parseTimeToMinutes(pattern.breakStart);
    const breakEnd = parseTimeToMinutes(pattern.breakEnd);

    if (dayStart !== null && minutes < dayStart) return NON_WORKING_CSS;
    if (dayEnd !== null && minutes >= dayEnd) return NON_WORKING_CSS;
    if (breakStart !== null && breakEnd !== null && minutes >= breakStart && minutes < breakEnd) {
      return NON_WORKING_CSS;
    }

    return '';
  };
}
