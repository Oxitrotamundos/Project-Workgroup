import { TaskScheduleCalculator } from './task-schedule-calculator.service';
import { ResolvedCalendar } from './calendar-resolver.service';

// Doble mínimo de SchedulingService: devuelve un rango/horas predecible.
const schedulingStub = {
  scheduleFromRange: ({ startDateTime, endDateTime }: any) => ({
    startDate: startDateTime,
    endDate: endDateTime,
    estimatedHours: 16,
    workload: [],
  }),
  scheduleFromHours: ({ startDateTime, estimatedHours }: any) => ({
    startDate: startDateTime,
    endDate: new Date(startDateTime.getTime() + estimatedHours * 3_600_000),
    estimatedHours,
    workload: [],
  }),
} as any;

const calendar = { hoursPerDay: 8 } as ResolvedCalendar;

describe('TaskScheduleCalculator', () => {
  const calc = new TaskScheduleCalculator(schedulingStub);

  it('treats a milestone as a zero-length point', () => {
    const start = new Date('2026-06-26T00:00:00Z');
    const s = calc.calculate(calendar, 'milestone', start);
    expect(s.startDate).toEqual(start);
    expect(s.endDate).toEqual(start);
    expect(s.duration).toBe('0');
  });

  it('computes duration from an explicit range', () => {
    const start = new Date('2026-06-26T00:00:00Z');
    const end = new Date('2026-06-28T00:00:00Z');
    const s = calc.calculate(calendar, 'task', start, end);
    expect(s.estimatedHours).toBe('16.00');
    expect(s.duration).toBe('2.00'); // 16h / 8h-per-day
  });

  it('rejects an inverted range', () => {
    const start = new Date('2026-06-28T00:00:00Z');
    const end = new Date('2026-06-26T00:00:00Z');
    expect(() => calc.calculate(calendar, 'task', start, end)).toThrow();
  });

  it('defaults to a single working day when neither end nor hours given', () => {
    const start = new Date('2026-06-26T00:00:00Z');
    const s = calc.calculate(calendar, 'task', start);
    expect(s.duration).toBe('1.00');
    expect(s.estimatedHours).toBe('8.00');
  });
});
