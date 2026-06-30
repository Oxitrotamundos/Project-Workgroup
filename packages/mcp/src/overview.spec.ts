import { describe, it, expect } from 'vitest';
import { buildOverview, formatProjectOverview } from './overview';

const project = {
  id: '9',
  name: 'KTP',
  status: 'active',
  startDate: '2026-04-01',
  endDate: '2026-08-01',
} as any;

const tasks = [
  { id: '1', type: 'task', status: 'completed', progress: 100, endDate: '2026-05-01T00:00:00.000Z', name: 'a' },
  { id: '2', type: 'task', status: 'in-progress', progress: 40, endDate: '2026-06-01T00:00:00.000Z', name: 'b' },
  { id: '3', type: 'summary', status: 'in-progress', progress: 70, endDate: '2026-07-01T00:00:00.000Z', name: 's' },
  { id: '4', type: 'milestone', status: 'not-started', progress: 0, endDate: '2026-07-15T00:00:00.000Z', name: 'm' },
] as any[];

const now = new Date('2026-06-10T00:00:00.000Z');

describe('buildOverview', () => {
  it('counts only non-summary leaves and averages their progress', () => {
    const o = buildOverview(project, tasks, now);
    expect(o.total).toBe(3); // excluye el summary
    expect(o.avgProgress).toBe(Math.round((100 + 40 + 0) / 3));
  });
  it('detects overdue non-completed leaves before now', () => {
    const o = buildOverview(project, tasks, now);
    // tarea 2 venció el 2026-06-01 y no está completa
    expect(o.overdue.map((x) => x.id)).toEqual(['2']);
  });
  it('lists upcoming milestones on/after now', () => {
    const o = buildOverview(project, tasks, now);
    expect(o.upcomingMilestones.map((x) => x.id)).toEqual(['4']);
  });
});

describe('formatProjectOverview', () => {
  it('renders a readable snapshot', () => {
    const text = formatProjectOverview(project, tasks, now);
    expect(text).toContain('[9] KTP');
    expect(text).toContain('atrasadas');
    expect(text).toContain('hitos próximos');
  });
  it('marks overflow when milestones exceed the cap', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      id: String(i),
      type: 'milestone',
      status: 'not-started',
      progress: 0,
      endDate: `2026-07-${String(i + 10).padStart(2, '0')}T00:00:00.000Z`,
      name: `m${i}`,
    })) as any[];
    expect(formatProjectOverview(project, many, now)).toContain('+2 más');
  });
});
