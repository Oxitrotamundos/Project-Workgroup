import { BadRequestException } from '@nestjs/common';
import { CalendarResolverService, ResolvedCalendar } from './calendar-resolver.service';
import { SchedulingService } from './scheduling.service';

const timeOf = (hhmm: string): Date => new Date(`1970-01-01T${hhmm}:00Z`);

const standardCalendar = (overrides: Partial<ResolvedCalendar> = {}): ResolvedCalendar => ({
  id: 1n,
  scope: 'global',
  projectId: null,
  name: 'Std',
  timezone: 'UTC',
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

describe('SchedulingService', () => {
  const make = () => {
    const resolver = new CalendarResolverService({} as any);
    return { service: new SchedulingService(resolver), resolver };
  };

  it('schedules an 8h task starting on Monday into a single Monday slot', () => {
    const { service } = make();
    const cal = standardCalendar();
    const monday = new Date(Date.UTC(2026, 4, 11));
    const result = service.scheduleTask({ estimatedHours: 8, startDate: monday, calendar: cal });

    expect(result.startDate.getTime()).toBe(monday.getTime());
    expect(result.endDate.getTime()).toBe(monday.getTime());
    expect(result.workload).toHaveLength(1);
    expect(result.workload[0].allocatedHours).toBe(8);
  });

  it('schedules a 10h task starting Friday so it skips the weekend', () => {
    const { service } = make();
    const cal = standardCalendar();
    const friday = new Date(Date.UTC(2026, 4, 15)); // viernes
    const nextMonday = new Date(Date.UTC(2026, 4, 18));
    const result = service.scheduleTask({ estimatedHours: 10, startDate: friday, calendar: cal });

    expect(result.startDate.getTime()).toBe(friday.getTime());
    expect(result.endDate.getTime()).toBe(nextMonday.getTime());
    expect(result.workload.map((w) => w.allocatedHours)).toEqual([8, 2]);
    // No hay filas para sábado/domingo
    expect(result.workload.find((w) => w.date.getUTCDay() === 0 || w.date.getUTCDay() === 6)).toBeUndefined();
  });

  it('skips holidays during scheduling', () => {
    const { service } = make();
    const tuesday = new Date(Date.UTC(2026, 4, 12));
    const cal = standardCalendar({
      holidays: [{ date: tuesday, label: 'Festivo', recurringYearly: false }],
    });
    const monday = new Date(Date.UTC(2026, 4, 11));
    const wednesday = new Date(Date.UTC(2026, 4, 13));
    const result = service.scheduleTask({ estimatedHours: 10, startDate: monday, calendar: cal });

    expect(result.endDate.getTime()).toBe(wednesday.getTime());
    expect(result.workload.find((w) => w.date.getTime() === tuesday.getTime())).toBeUndefined();
  });

  it('advances startDate to the next working day when given a holiday/weekend', () => {
    const { service } = make();
    const cal = standardCalendar();
    const saturday = new Date(Date.UTC(2026, 4, 16));
    const monday = new Date(Date.UTC(2026, 4, 18));
    const result = service.scheduleTask({ estimatedHours: 8, startDate: saturday, calendar: cal });

    expect(result.startDate.getTime()).toBe(monday.getTime());
    expect(result.endDate.getTime()).toBe(monday.getTime());
  });

  it('respects half-day patterns when computing capacity', () => {
    const { service } = make();
    const cal = standardCalendar();
    // Viernes media jornada de 4h (sin pausa)
    cal.patterns[5] = {
      weekday: 5,
      enabled: true,
      dayStart: timeOf('09:00'),
      breakStart: null,
      breakEnd: null,
      dayEnd: timeOf('13:00'),
    };
    const friday = new Date(Date.UTC(2026, 4, 15));
    const result = service.scheduleTask({ estimatedHours: 4, startDate: friday, calendar: cal });

    expect(result.endDate.getTime()).toBe(friday.getTime());
    expect(result.workload).toEqual([{ date: friday, allocatedHours: 4 }]);
  });

  it('rejects non-positive estimatedHours', () => {
    const { service } = make();
    const cal = standardCalendar();
    const monday = new Date(Date.UTC(2026, 4, 11));
    expect(() => service.scheduleTask({ estimatedHours: 0, startDate: monday, calendar: cal })).toThrow(BadRequestException);
    expect(() => service.scheduleTask({ estimatedHours: -1, startDate: monday, calendar: cal })).toThrow(BadRequestException);
  });
});
