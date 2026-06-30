import { describe, it, expect } from 'vitest';
import { filterTasks } from './tasks-filter';

const t = (over: Record<string, unknown>) =>
  ({
    id: '1',
    type: 'task',
    status: 'in-progress',
    assigneeId: null,
    startDate: '2026-06-01T00:00:00.000Z',
    endDate: '2026-06-10T00:00:00.000Z',
    progress: 0,
    name: 'x',
    ...over,
  }) as any;

describe('filterTasks', () => {
  const tasks = [
    t({ id: '1', status: 'in-progress', type: 'task', assigneeId: '5' }),
    t({
      id: '2',
      status: 'completed',
      type: 'milestone',
      startDate: '2026-06-20T00:00:00.000Z',
      endDate: '2026-06-25T00:00:00.000Z',
    }),
    t({
      id: '3',
      status: 'in-progress',
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-07-05T00:00:00.000Z',
    }),
  ];

  it('returns all tasks with an empty filter', () => {
    expect(filterTasks(tasks, {})).toHaveLength(3);
  });
  it('filters by status', () => {
    expect(filterTasks(tasks, { status: 'completed' }).map((x) => x.id)).toEqual(['2']);
  });
  it('filters by type and assignee', () => {
    expect(filterTasks(tasks, { type: 'task', assigneeId: '5' }).map((x) => x.id)).toEqual(['1']);
  });
  it('filters by date window (overlap)', () => {
    const r = filterTasks(tasks, { from: '2026-06-15', to: '2026-06-30' });
    // La tarea 1 (jun 1-10) queda fuera por terminar antes de `from`; la 3 (jul) por empezar tras `to`.
    expect(r.map((x) => x.id)).toEqual(['2']);
  });
  it('ignores a malformed date bound instead of disabling the filter silently', () => {
    expect(filterTasks(tasks, { from: 'not-a-date' })).toHaveLength(3);
  });
});
