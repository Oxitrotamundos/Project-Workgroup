import { CalendarResolverService, ResolvedCalendar } from './calendar-resolver.service';

const timeOf = (hhmm: string): Date => new Date(`1970-01-01T${hhmm}:00Z`);

const standardCalendar = (overrides: Partial<ResolvedCalendar> = {}): ResolvedCalendar => ({
  id: 1n,
  scope: 'global',
  projectId: null,
  name: 'Std',
  timezone: 'America/Lima',
  patterns: [
    { weekday: 0, enabled: false, dayStart: null, breakStart: null, breakEnd: null, dayEnd: null },
    { weekday: 1, enabled: true, dayStart: timeOf('09:00'), breakStart: timeOf('13:00'), breakEnd: timeOf('14:00'), dayEnd: timeOf('18:00') },
    { weekday: 2, enabled: true, dayStart: timeOf('09:00'), breakStart: timeOf('13:00'), breakEnd: timeOf('14:00'), dayEnd: timeOf('18:00') },
    { weekday: 3, enabled: true, dayStart: timeOf('09:00'), breakStart: timeOf('13:00'), breakEnd: timeOf('14:00'), dayEnd: timeOf('18:00') },
    { weekday: 4, enabled: true, dayStart: timeOf('09:00'), breakStart: timeOf('13:00'), breakEnd: timeOf('14:00'), dayEnd: timeOf('18:00') },
    { weekday: 5, enabled: true, dayStart: timeOf('09:00'), breakStart: timeOf('13:00'), breakEnd: timeOf('14:00'), dayEnd: timeOf('18:00') },
    { weekday: 6, enabled: false, dayStart: null, breakStart: null, breakEnd: null, dayEnd: null },
  ],
  holidays: [],
  hoursPerDay: 8,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('CalendarResolverService', () => {
  const make = () => new CalendarResolverService({} as any);

  it('computes hours for a weekday accounting for the lunch break', () => {
    const svc = make();
    const cal = standardCalendar();
    // Lunes: 9-13 + 14-18 = 8 horas
    expect(svc.hoursForWeekday(cal, 1)).toBe(8);
  });

  it('returns full day hours when there is no break', () => {
    const svc = make();
    const cal = standardCalendar();
    cal.patterns[1] = {
      weekday: 1,
      enabled: true,
      dayStart: timeOf('09:00'),
      breakStart: null,
      breakEnd: null,
      dayEnd: timeOf('13:00'),
    };
    expect(svc.hoursForWeekday(cal, 1)).toBe(4);
  });

  it('returns zero for disabled weekdays', () => {
    const svc = make();
    const cal = standardCalendar();
    expect(svc.hoursForWeekday(cal, 0)).toBe(0);
    expect(svc.hoursForWeekday(cal, 6)).toBe(0);
  });

  it('averages effective hours across enabled weekdays only', () => {
    const svc = make();
    const cal = standardCalendar();
    expect(svc.effectiveHoursPerDay(cal)).toBe(8);
  });

  it('marks weekends as non-working days', () => {
    const svc = make();
    const cal = standardCalendar();
    const sunday = new Date(Date.UTC(2026, 4, 10)); // 2026-05-10 was a Sunday
    const monday = new Date(Date.UTC(2026, 4, 11));
    expect(svc.isWorkingDay(cal, sunday)).toBe(false);
    expect(svc.isWorkingDay(cal, monday)).toBe(true);
  });

  it('treats yearly recurring holidays as holidays in any year', () => {
    const svc = make();
    const cal = standardCalendar({
      holidays: [{ date: new Date(Date.UTC(2020, 4, 1)), label: 'Día del Trabajo', recurringYearly: true }],
    });
    const mayFirst2026 = new Date(Date.UTC(2026, 4, 1));
    const mayFirst2030 = new Date(Date.UTC(2030, 4, 1));
    expect(svc.isHoliday(cal, mayFirst2026)).toBe(true);
    expect(svc.isHoliday(cal, mayFirst2030)).toBe(true);
  });

  it('treats Feb-29 recurring holidays as active only on leap years', () => {
    const svc = make();
    const cal = standardCalendar({
      holidays: [{ date: new Date(Date.UTC(2020, 1, 29)), label: 'Bisiesto', recurringYearly: true }],
    });
    const leapDay2024 = new Date(Date.UTC(2024, 1, 29));
    const feb28_2026 = new Date(Date.UTC(2026, 1, 28));
    expect(svc.isHoliday(cal, leapDay2024)).toBe(true);
    expect(svc.isHoliday(cal, feb28_2026)).toBe(false);
  });

  it('treats specific (non-recurring) holidays as exact-date only', () => {
    const svc = make();
    const cal = standardCalendar({
      holidays: [{ date: new Date(Date.UTC(2026, 6, 28)), label: 'Independencia', recurringYearly: false }],
    });
    expect(svc.isHoliday(cal, new Date(Date.UTC(2026, 6, 28)))).toBe(true);
    expect(svc.isHoliday(cal, new Date(Date.UTC(2027, 6, 28)))).toBe(false);
  });
});
