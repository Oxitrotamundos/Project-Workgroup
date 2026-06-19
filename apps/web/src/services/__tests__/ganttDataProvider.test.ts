import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GanttDataProvider, toGanttId } from '../ganttDataProvider';
import { TaskService } from '../taskService';
import type { Task } from '../../types/domain';

vi.mock('../taskService', () => ({
  TaskService: {
    updateTaskWithMeta: vi.fn(),
    updateTaskPosition: vi.fn(),
    updateOpenStates: vi.fn(),
    updateTask: vi.fn(),
    updateTaskOrder: vi.fn(),
    getDescendants: vi.fn(),
    bulkUpdate: vi.fn(),
  },
}));

const baseTask = (overrides: Partial<Task> = {}): Task => ({
  id: '1',
  projectId: 'p1',
  name: 'Original',
  description: '',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-01-02T00:00:00.000Z',
  duration: 1,
  progress: 0,
  assigneeId: undefined,
  parentId: undefined,
  dependencies: [],
  tags: [],
  priority: 'medium',
  color: '#3B82F6',
  estimatedHours: 8,
  actualHours: undefined,
  status: 'not-started',
  type: 'task',
  order: 1,
  open: true,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('GanttDataProvider actions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves superseded update promises and persists only the final update', async () => {
    const provider = new GanttDataProvider('p1');
    provider.syncFromData([baseTask()], []);
    vi.mocked(TaskService.updateTaskWithMeta).mockResolvedValue({
      task: baseTask({ name: 'Final', version: 2 }),
      summariesPatched: [],
    });

    const first = provider.send('update-task', { id: '1', task: { text: 'Intermedio' } });
    const second = provider.send('update-task', { id: '1', task: { text: 'Final' } });

    await vi.advanceTimersByTimeAsync(200);

    await expect(first).resolves.toMatchObject({ superseded: true });
    await expect(second).resolves.toMatchObject({ success: true });
    expect(TaskService.updateTaskWithMeta).toHaveBeenCalledTimes(1);
    expect(TaskService.updateTaskWithMeta).toHaveBeenCalledWith('1', {
      name: 'Final',
      expectedVersion: 1,
    });
  });

  it('moves a task through the position endpoint without legacy parent/order calls', async () => {
    const provider = new GanttDataProvider('p1');
    provider.syncFromData([baseTask(), baseTask({ id: '2', name: 'Target', order: 2 })], []);
    const api = {
      getTask: vi.fn(() => ({ id: 1, parent: 0 })),
      exec: vi.fn(),
    } as any;
    provider.setGanttApi(api);
    vi.mocked(TaskService.updateTaskPosition).mockResolvedValue({
      task: baseTask({ order: 3, version: 2 }),
      summariesPatched: [],
    });

    const result = provider.send('move-task', { id: '1', target: '2', mode: 'after' });
    await vi.advanceTimersByTimeAsync(200);

    await expect(result).resolves.toMatchObject({ success: true });
    expect(TaskService.updateTaskPosition).toHaveBeenCalledWith('1', {
      parentId: null,
      afterTaskId: '2',
      expectedVersion: 1,
    });
    expect(TaskService.updateTask).not.toHaveBeenCalled();
    expect(TaskService.updateTaskOrder).not.toHaveBeenCalled();
    expect(TaskService.getDescendants).not.toHaveBeenCalled();
  });

  it('treats equivalent ISO date strings as same in syncFromTasks', async () => {
    const provider = new GanttDataProvider('p1');
    const initial = baseTask({
      startDate: '2026-01-01T08:30:00.000Z',
      endDate: '2026-01-02T08:30:00.000Z',
    });
    provider.syncFromData([initial], []);
    const api = {
      getTask: vi.fn(() => ({ id: 1, start: new Date(initial.startDate), end: new Date(initial.endDate) })),
      exec: vi.fn(),
    } as any;
    provider.setGanttApi(api);

    const sameMoment = baseTask({
      startDate: '2026-01-01T08:30:00Z',
      endDate: '2026-01-02T08:30:00Z',
    });
    provider.syncFromData([sameMoment], []);

    expect(api.exec).not.toHaveBeenCalledWith(
      'update-task',
      expect.objectContaining({ id: 1 }),
    );
  });

  it('batches expand/collapse persistence through open-states', async () => {
    const provider = new GanttDataProvider('p1');
    provider.syncFromData([
      baseTask({ id: '1', open: true }),
      baseTask({ id: '2', name: 'Second', open: true }),
    ], []);
    vi.mocked(TaskService.updateOpenStates).mockResolvedValue({
      updated: [
        { id: '1', open: false, version: 2 },
        { id: '2', open: false, version: 2 },
      ],
    });

    await provider.handleExpandCollapseState({ id: '1', isOpen: false });
    await provider.handleExpandCollapseState({ id: '2', isOpen: false });
    await vi.advanceTimersByTimeAsync(400);

    expect(TaskService.updateOpenStates).toHaveBeenCalledTimes(1);
    expect(TaskService.updateOpenStates).toHaveBeenCalledWith('p1', [
      { id: '1', open: false, expectedVersion: 1 },
      { id: '2', open: false, expectedVersion: 1 },
    ]);
  });

  it('syncFromTasks refleja altas (id nuevo) y bajas (id ausente) en el store de forma imperativa', () => {
    const provider = new GanttDataProvider('p1');
    // Estado inicial: tareas 1 y 2 (el api se conecta después, igual que en runtime).
    provider.syncFromData([baseTask({ id: '1' }), baseTask({ id: '2', name: 'Two' })], []);
    const api = {
      getTask: vi.fn(() => undefined),
      exec: vi.fn(),
    } as any;
    provider.setGanttApi(api);

    // Llega un dataset con alta de '3' y baja de '2', SIN regenerar la prop de <Gantt>.
    provider.syncFromTasks([baseTask({ id: '1' }), baseTask({ id: '3', name: 'Three' })]);

    // Alta → exec 'update-task' para el id nuevo (3); baja → exec 'delete-task' para el ausente (2).
    expect(api.exec).toHaveBeenCalledWith(
      'update-task',
      expect.objectContaining({ id: 3, _silent: true }),
    );
    expect(api.exec).toHaveBeenCalledWith(
      'delete-task',
      expect.objectContaining({ id: 2, _silent: true }),
    );
  });

  it('agrupa las hojas propagadas (eventSource) de un move de summary en un único bulkUpdate', async () => {
    const provider = new GanttDataProvider('p1');
    provider.syncFromData(
      [
        baseTask({ id: '125', type: 'summary', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-12T00:00:00.000Z' }),
        baseTask({ id: '128', parentId: '125', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-02T00:00:00.000Z' }),
        baseTask({ id: '129', parentId: '125', startDate: '2026-01-03T00:00:00.000Z', endDate: '2026-01-04T00:00:00.000Z' }),
      ],
      [],
    );
    const api = { getTask: vi.fn(() => undefined), exec: vi.fn() } as any;
    provider.setGanttApi(api);
    vi.mocked(TaskService.bulkUpdate).mockResolvedValue({ tasks: [], summariesPatched: [] });

    // Propagaciones de hijos (con eventSource) emitidas por wx al mover la summary 125.
    void provider.send('update-task', {
      id: '128',
      task: { type: 'task', start: new Date('2026-01-08T00:00:00.000Z'), end: new Date('2026-01-09T00:00:00.000Z') },
      eventSource: 'update-task',
    });
    void provider.send('update-task', {
      id: '129',
      task: { type: 'task', start: new Date('2026-01-10T00:00:00.000Z'), end: new Date('2026-01-11T00:00:00.000Z') },
      eventSource: 'update-task',
    });
    // Propagación de un ancestro summary: debe IGNORARSE (se deriva de sus hijas).
    void provider.send('update-task', {
      id: '122',
      task: { type: 'summary', start: new Date('2026-01-08T00:00:00.000Z'), end: new Date('2026-01-19T00:00:00.000Z') },
      eventSource: 'update-task',
    });

    await vi.advanceTimersByTimeAsync(60);

    expect(TaskService.bulkUpdate).toHaveBeenCalledTimes(1);
    const [proj, items] = vi.mocked(TaskService.bulkUpdate).mock.calls[0];
    expect(proj).toBe('p1');
    expect(items.map((i) => i.id).sort()).toEqual(['128', '129']); // solo hojas, no el summary 122
    const i128 = items.find((i) => i.id === '128')!;
    expect(i128.data.startDate).toBe('2026-01-08T00:00:00.000Z');
    expect(i128.data.endDate).toBe('2026-01-09T00:00:00.000Z');
    expect(i128.expectedVersion).toBe(1);
  });

  it('deriva las fechas de un summary desde sus hojas (ignora la fecha desincronizada del backend)', () => {
    const provider = new GanttDataProvider('p1');
    const data = provider.syncFromData(
      [
        // El backend trae el summary desincronizado (marzo) — NO abarca a sus hijas (enero/febrero).
        baseTask({ id: '100', name: 'S', type: 'summary', startDate: '2026-03-01T00:00:00.000Z', endDate: '2026-03-05T00:00:00.000Z' }),
        baseTask({ id: '101', parentId: '100', startDate: '2026-01-10T00:00:00.000Z', endDate: '2026-01-15T00:00:00.000Z' }),
        baseTask({ id: '102', parentId: '100', startDate: '2026-02-01T00:00:00.000Z', endDate: '2026-02-20T00:00:00.000Z' }),
      ],
      [],
    );
    const summary = data.tasks.find((t) => String(t.id) === '100')!;
    // El summary abarca a sus hijas: min(101.start)=2026-01-10, max(102.end)=2026-02-20.
    expect(summary.start.toISOString()).toBe('2026-01-10T00:00:00.000Z');
    expect(summary.end.toISOString()).toBe('2026-02-20T00:00:00.000Z');
  });

  it('deriva las fechas de un summary a través de sub-summaries (nietas)', () => {
    const provider = new GanttDataProvider('p1');
    const data = provider.syncFromData(
      [
        baseTask({ id: '200', name: 'Abuelo', type: 'summary', startDate: '2026-05-01T00:00:00.000Z', endDate: '2026-05-02T00:00:00.000Z' }),
        baseTask({ id: '201', name: 'Padre', type: 'summary', parentId: '200', startDate: '2026-05-01T00:00:00.000Z', endDate: '2026-05-02T00:00:00.000Z' }),
        baseTask({ id: '202', parentId: '201', startDate: '2026-01-05T00:00:00.000Z', endDate: '2026-01-08T00:00:00.000Z' }),
        baseTask({ id: '203', parentId: '201', startDate: '2026-03-10T00:00:00.000Z', endDate: '2026-03-15T00:00:00.000Z' }),
      ],
      [],
    );
    const grandparent = data.tasks.find((t) => String(t.id) === '200')!;
    // Abarca a las nietas: min(202.start)=2026-01-05, max(203.end)=2026-03-15.
    expect(grandparent.start.toISOString()).toBe('2026-01-05T00:00:00.000Z');
    expect(grandparent.end.toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });
});

describe('toGanttId', () => {
  it('converts numeric strings to numbers (matches what the lib does internally)', () => {
    expect(toGanttId('123')).toBe(123);
    expect(toGanttId('1')).toBe(1);
    expect(toGanttId('0')).toBe(0);
  });

  it('keeps numbers as numbers', () => {
    expect(toGanttId(42)).toBe(42);
  });

  it('returns undefined for null, undefined, and empty string', () => {
    expect(toGanttId(null)).toBeUndefined();
    expect(toGanttId(undefined)).toBeUndefined();
    expect(toGanttId('')).toBeUndefined();
  });

  it('preserves non-numeric strings as-is (e.g. temp:// ids)', () => {
    expect(toGanttId('temp://abc')).toBe('temp://abc');
    expect(toGanttId('uuid-xxx')).toBe('uuid-xxx');
  });

  it('handles bigints by converting to number when safe', () => {
    expect(toGanttId(123n)).toBe(123);
  });

  it('falls back to string when numeric value exceeds Number.MAX_SAFE_INTEGER', () => {
    const huge = '9007199254740993'; // > 2^53
    expect(toGanttId(huge)).toBe(huge);
  });
});
