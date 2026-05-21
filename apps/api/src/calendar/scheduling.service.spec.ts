import { BadRequestException } from '@nestjs/common';
import {
  CalendarResolverService,
  ResolvedCalendar,
} from './calendar-resolver.service';
import { SchedulingService } from './scheduling.service';

const timeOf = (hhmm: string): Date => new Date(`1970-01-01T${hhmm}:00Z`);

const dt = (y: number, m: number, d: number, h = 0, min = 0): Date =>
  new Date(Date.UTC(y, m, d, h, min));

const standardCalendar = (
  overrides: Partial<ResolvedCalendar> = {},
): ResolvedCalendar => ({
  id: 1n,
  scope: 'global',
  projectId: null,
  name: 'Std',
  timezone: 'UTC',
  patterns: [
    {
      weekday: 0,
      enabled: false,
      dayStart: null,
      breakStart: null,
      breakEnd: null,
      dayEnd: null,
    },
    {
      weekday: 1,
      enabled: true,
      dayStart: timeOf('09:00'),
      breakStart: timeOf('13:00'),
      breakEnd: timeOf('14:00'),
      dayEnd: timeOf('18:00'),
    },
    {
      weekday: 2,
      enabled: true,
      dayStart: timeOf('09:00'),
      breakStart: timeOf('13:00'),
      breakEnd: timeOf('14:00'),
      dayEnd: timeOf('18:00'),
    },
    {
      weekday: 3,
      enabled: true,
      dayStart: timeOf('09:00'),
      breakStart: timeOf('13:00'),
      breakEnd: timeOf('14:00'),
      dayEnd: timeOf('18:00'),
    },
    {
      weekday: 4,
      enabled: true,
      dayStart: timeOf('09:00'),
      breakStart: timeOf('13:00'),
      breakEnd: timeOf('14:00'),
      dayEnd: timeOf('18:00'),
    },
    {
      weekday: 5,
      enabled: true,
      dayStart: timeOf('09:00'),
      breakStart: timeOf('13:00'),
      breakEnd: timeOf('14:00'),
      dayEnd: timeOf('18:00'),
    },
    {
      weekday: 6,
      enabled: false,
      dayStart: null,
      breakStart: null,
      breakEnd: null,
      dayEnd: null,
    },
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

  describe('scheduleFromHours', () => {
    it('schedules an 8h task starting on Monday 00:00 into the Monday slots', () => {
      const { service } = make();
      const cal = standardCalendar();
      const monday = dt(2026, 4, 11);
      const result = service.scheduleFromHours({
        estimatedHours: 8,
        startDateTime: monday,
        calendar: cal,
      });

      expect(result.startDate.getTime()).toBe(dt(2026, 4, 11, 9).getTime());
      expect(result.endDate.getTime()).toBe(dt(2026, 4, 11, 18).getTime());
      expect(result.workload).toHaveLength(1);
      expect(result.workload[0].allocatedHours).toBe(8);
    });

    it('schedules a 10h task starting Friday so it skips the weekend', () => {
      const { service } = make();
      const cal = standardCalendar();
      const friday = dt(2026, 4, 15);
      const result = service.scheduleFromHours({
        estimatedHours: 10,
        startDateTime: friday,
        calendar: cal,
      });

      expect(result.startDate.getTime()).toBe(dt(2026, 4, 15, 9).getTime());
      expect(result.endDate.getTime()).toBe(dt(2026, 4, 18, 11).getTime());
      expect(result.workload.map((w) => w.allocatedHours)).toEqual([8, 2]);
      expect(
        result.workload.find(
          (w) => w.date.getUTCDay() === 0 || w.date.getUTCDay() === 6,
        ),
      ).toBeUndefined();
    });

    it('skips holidays during scheduling', () => {
      const { service } = make();
      const tuesday = dt(2026, 4, 12);
      const cal = standardCalendar({
        holidays: [{ date: tuesday, label: 'Festivo', recurringYearly: false }],
      });
      const monday = dt(2026, 4, 11);
      const result = service.scheduleFromHours({
        estimatedHours: 10,
        startDateTime: monday,
        calendar: cal,
      });

      expect(result.endDate.getTime()).toBe(dt(2026, 4, 13, 11).getTime());
      expect(
        result.workload.find((w) => w.date.getTime() === tuesday.getTime()),
      ).toBeUndefined();
    });

    it('advances startDate to the next working day when given a weekend', () => {
      const { service } = make();
      const cal = standardCalendar();
      const saturday = dt(2026, 4, 16);
      const result = service.scheduleFromHours({
        estimatedHours: 8,
        startDateTime: saturday,
        calendar: cal,
      });

      expect(result.startDate.getTime()).toBe(dt(2026, 4, 18, 9).getTime());
      expect(result.endDate.getTime()).toBe(dt(2026, 4, 18, 18).getTime());
    });

    it('starts mid-day when startDateTime cae dentro de un slot laboral', () => {
      const { service } = make();
      const cal = standardCalendar();
      const mondayNoon = dt(2026, 4, 11, 12);
      const result = service.scheduleFromHours({
        estimatedHours: 8,
        startDateTime: mondayNoon,
        calendar: cal,
      });

      expect(result.startDate.getTime()).toBe(mondayNoon.getTime());
      expect(result.endDate.getTime()).toBe(dt(2026, 4, 12, 12).getTime());
      expect(result.workload.map((w) => w.allocatedHours)).toEqual([5, 3]);
    });

    it('jumps over the break when startDateTime cae en el break', () => {
      const { service } = make();
      const cal = standardCalendar();
      const mondayBreak = dt(2026, 4, 11, 13, 30);
      const result = service.scheduleFromHours({
        estimatedHours: 4,
        startDateTime: mondayBreak,
        calendar: cal,
      });

      expect(result.startDate.getTime()).toBe(dt(2026, 4, 11, 14).getTime());
      expect(result.endDate.getTime()).toBe(dt(2026, 4, 11, 18).getTime());
    });

    it('advances to next day when startDateTime cae después de dayEnd', () => {
      const { service } = make();
      const cal = standardCalendar();
      const mondayEvening = dt(2026, 4, 11, 20);
      const result = service.scheduleFromHours({
        estimatedHours: 4,
        startDateTime: mondayEvening,
        calendar: cal,
      });

      expect(result.startDate.getTime()).toBe(dt(2026, 4, 12, 9).getTime());
      expect(result.endDate.getTime()).toBe(dt(2026, 4, 12, 13).getTime());
    });

    it('respects half-day patterns when computing capacity', () => {
      const { service } = make();
      const cal = standardCalendar();
      cal.patterns[5] = {
        weekday: 5,
        enabled: true,
        dayStart: timeOf('09:00'),
        breakStart: null,
        breakEnd: null,
        dayEnd: timeOf('13:00'),
      };
      const friday = dt(2026, 4, 15);
      const result = service.scheduleFromHours({
        estimatedHours: 4,
        startDateTime: friday,
        calendar: cal,
      });

      expect(result.startDate.getTime()).toBe(dt(2026, 4, 15, 9).getTime());
      expect(result.endDate.getTime()).toBe(dt(2026, 4, 15, 13).getTime());
      expect(result.workload).toEqual([{ date: friday, allocatedHours: 4 }]);
    });

    it('rejects non-positive estimatedHours', () => {
      const { service } = make();
      const cal = standardCalendar();
      const monday = dt(2026, 4, 11);
      expect(() =>
        service.scheduleFromHours({
          estimatedHours: 0,
          startDateTime: monday,
          calendar: cal,
        }),
      ).toThrow(BadRequestException);
      expect(() =>
        service.scheduleFromHours({
          estimatedHours: -1,
          startDateTime: monday,
          calendar: cal,
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('workingHoursInRange', () => {
    it('counts 24h for a 3-day Mon→Thu (exclusive) range starting at 00:00', () => {
      const { service } = make();
      const cal = standardCalendar();
      const hours = service.workingHoursInRange(
        cal,
        dt(2026, 4, 11),
        dt(2026, 4, 14),
      );
      expect(hours).toBe(24);
    });

    it('counts only working portion when crossing the weekend', () => {
      const { service } = make();
      const cal = standardCalendar();
      const hours = service.workingHoursInRange(
        cal,
        dt(2026, 4, 15, 14),
        dt(2026, 4, 18, 11),
      );
      expect(hours).toBe(6);
    });

    it('excludes a holiday in the middle of the range', () => {
      const { service } = make();
      const cal = standardCalendar({
        holidays: [
          { date: dt(2026, 4, 12), label: 'Festivo', recurringYearly: false },
        ],
      });
      const hours = service.workingHoursInRange(
        cal,
        dt(2026, 4, 11),
        dt(2026, 4, 13),
      );
      expect(hours).toBe(8);
    });

    it('returns 0 when end <= start', () => {
      const { service } = make();
      const cal = standardCalendar();
      expect(
        service.workingHoursInRange(cal, dt(2026, 4, 11), dt(2026, 4, 11)),
      ).toBe(0);
      expect(
        service.workingHoursInRange(cal, dt(2026, 4, 12), dt(2026, 4, 11)),
      ).toBe(0);
    });

    it('clips the break time out of partial-day ranges', () => {
      const { service } = make();
      const cal = standardCalendar();
      const hours = service.workingHoursInRange(
        cal,
        dt(2026, 4, 11, 12),
        dt(2026, 4, 11, 15),
      );
      expect(hours).toBe(2);
    });
  });

  describe('scheduleFromRange', () => {
    it('preserves user-provided start and end and returns the working hours within', () => {
      const { service } = make();
      const cal = standardCalendar();
      const start = dt(2026, 4, 11);
      const end = dt(2026, 4, 14);
      const result = service.scheduleFromRange({
        startDateTime: start,
        endDateTime: end,
        calendar: cal,
      });

      expect(result.startDate.getTime()).toBe(start.getTime());
      expect(result.endDate.getTime()).toBe(end.getTime());
      expect(result.estimatedHours).toBe(24);
      expect(result.workload.map((w) => w.allocatedHours)).toEqual([8, 8, 8]);
    });

    it('honors mid-day end and counts partial last day', () => {
      const { service } = make();
      const cal = standardCalendar();
      const start = dt(2026, 4, 14);
      const end = dt(2026, 4, 16, 10);
      const result = service.scheduleFromRange({
        startDateTime: start,
        endDateTime: end,
        calendar: cal,
      });

      expect(result.endDate.getTime()).toBe(end.getTime());
      expect(result.estimatedHours).toBe(16);
    });

    it('rejects end <= start', () => {
      const { service } = make();
      const cal = standardCalendar();
      expect(() =>
        service.scheduleFromRange({
          startDateTime: dt(2026, 4, 11),
          endDateTime: dt(2026, 4, 11),
          calendar: cal,
        }),
      ).toThrow(BadRequestException);
    });
  });
});
