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

  it('mueve una summary como grupo: desplaza y persiste solo las hojas con el delta', async () => {
    const provider = new GanttDataProvider('p1');
    provider.syncFromData(
      [
        baseTask({ id: 'S', name: 'Summary', type: 'summary', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-10T00:00:00.000Z' }),
        baseTask({ id: 'A', parentId: 'S', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-02T00:00:00.000Z' }),
        baseTask({ id: 'B', parentId: 'S', startDate: '2026-01-03T00:00:00.000Z', endDate: '2026-01-04T00:00:00.000Z' }),
        baseTask({ id: 'S2', name: 'Sub', type: 'summary', parentId: 'S', startDate: '2026-01-05T00:00:00.000Z', endDate: '2026-01-10T00:00:00.000Z' }),
        baseTask({ id: 'C', parentId: 'S2', startDate: '2026-01-05T00:00:00.000Z', endDate: '2026-01-10T00:00:00.000Z' }),
      ],
      [],
    );
    const api = { getTask: vi.fn(() => undefined), exec: vi.fn() } as any;
    provider.setGanttApi(api);
    vi.mocked(TaskService.bulkUpdate).mockResolvedValue({ tasks: [], summariesPatched: [] });

    // Move de +7 días (la summary va de 2026-01-01 a 2026-01-08).
    const result = provider.send('update-task', {
      id: 'S',
      task: { start: new Date('2026-01-08T00:00:00.000Z'), end: new Date('2026-01-17T00:00:00.000Z') },
    });
    await vi.advanceTimersByTimeAsync(200);
    await expect(result).resolves.toMatchObject({ success: true });

    expect(TaskService.bulkUpdate).toHaveBeenCalledTimes(1);
    const [proj, updates] = vi.mocked(TaskService.bulkUpdate).mock.calls[0];
    expect(proj).toBe('p1');
    expect(updates.map((u) => u.id).sort()).toEqual(['A', 'B', 'C']); // solo hojas, no S ni S2
    const a = updates.find((u) => u.id === 'A')!;
    expect(a.data.startDate).toBe('2026-01-08T00:00:00.000Z');
    expect(a.data.endDate).toBe('2026-01-09T00:00:00.000Z');
    expect(a.expectedVersion).toBe(1);
  });

  it('suprime los update-task con eventSource (propagación interna de wx) sin persistir', async () => {
    const provider = new GanttDataProvider('p1');
    provider.syncFromData([baseTask({ id: 'A' })], []);

    const result = await provider.send('update-task', {
      id: 'A',
      task: { start: new Date('2026-02-01T00:00:00.000Z'), end: new Date('2026-02-02T00:00:00.000Z') },
      eventSource: 'update-task',
    });

    expect(result).toMatchObject({ success: true });
    expect(TaskService.bulkUpdate).not.toHaveBeenCalled();
    expect(TaskService.updateTaskWithMeta).not.toHaveBeenCalled();
  });

  it('mover una hoja individual (sin eventSource) sigue persistiendo vía updateTaskWithMeta', async () => {
    const provider = new GanttDataProvider('p1');
    provider.syncFromData([baseTask({ id: 'A', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-02T00:00:00.000Z' })], []);
    const api = { getTask: vi.fn(() => undefined), exec: vi.fn() } as any;
    provider.setGanttApi(api);
    vi.mocked(TaskService.updateTaskWithMeta).mockResolvedValue({ task: baseTask({ id: 'A', version: 2 }), summariesPatched: [] });

    const result = provider.send('update-task', {
      id: 'A',
      task: { start: new Date('2026-01-08T00:00:00.000Z'), end: new Date('2026-01-09T00:00:00.000Z') },
    });
    await vi.advanceTimersByTimeAsync(200);
    await expect(result).resolves.toMatchObject({ success: true });

    expect(TaskService.updateTaskWithMeta).toHaveBeenCalledWith(
      'A',
      expect.objectContaining({ startDate: '2026-01-08T00:00:00.000Z', endDate: '2026-01-09T00:00:00.000Z' }),
    );
    expect(TaskService.bulkUpdate).not.toHaveBeenCalled();
  });

  it('no persiste el resize de una summary (solo cambia un extremo)', async () => {
    const provider = new GanttDataProvider('p1');
    provider.syncFromData(
      [
        baseTask({ id: 'S', type: 'summary', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-10T00:00:00.000Z' }),
        baseTask({ id: 'A', parentId: 'S' }),
      ],
      [],
    );
    const api = { getTask: vi.fn(() => undefined), exec: vi.fn() } as any;
    provider.setGanttApi(api);

    const result = provider.send('update-task', { id: 'S', task: { end: new Date('2026-01-20T00:00:00.000Z') } });
    await vi.advanceTimersByTimeAsync(200);
    await expect(result).resolves.toMatchObject({ success: true });

    expect(TaskService.bulkUpdate).not.toHaveBeenCalled();
  });

  it('divide en lotes de 200 cuando hay más de 200 hojas', async () => {
    const tasks = [baseTask({ id: 'S', type: 'summary', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-10T00:00:00.000Z' })];
    for (let i = 0; i < 250; i++) {
      tasks.push(baseTask({ id: `L${i}`, parentId: 'S', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-02T00:00:00.000Z' }));
    }
    const provider = new GanttDataProvider('p1');
    provider.syncFromData(tasks, []);
    const api = { getTask: vi.fn(() => undefined), exec: vi.fn() } as any;
    provider.setGanttApi(api);
    vi.mocked(TaskService.bulkUpdate).mockResolvedValue({ tasks: [], summariesPatched: [] });

    const result = provider.send('update-task', {
      id: 'S',
      task: { start: new Date('2026-01-08T00:00:00.000Z'), end: new Date('2026-01-17T00:00:00.000Z') },
    });
    await vi.advanceTimersByTimeAsync(200);
    await expect(result).resolves.toMatchObject({ success: true });

    expect(TaskService.bulkUpdate).toHaveBeenCalledTimes(2);
    expect(vi.mocked(TaskService.bulkUpdate).mock.calls.map((c) => c[1].length)).toEqual([200, 50]);
  });

  it('ante error en el bulk, revierte visualmente las hojas y emite onError', async () => {
    const provider = new GanttDataProvider('p1');
    provider.syncFromData(
      [
        baseTask({ id: 'S', type: 'summary', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-10T00:00:00.000Z' }),
        baseTask({ id: 'A', parentId: 'S', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-02T00:00:00.000Z' }),
      ],
      [],
    );
    const api = { getTask: vi.fn(() => undefined), exec: vi.fn() } as any;
    provider.setGanttApi(api);
    const onError = vi.fn();
    provider.setOnError(onError);
    vi.mocked(TaskService.bulkUpdate).mockRejectedValue(new Error('version conflict'));

    const result = provider.send('update-task', {
      id: 'S',
      task: { start: new Date('2026-01-08T00:00:00.000Z'), end: new Date('2026-01-17T00:00:00.000Z') },
    });
    // Adjuntar el handler de rechazo ANTES de avanzar los timers para no dejar la rejection huérfana.
    const rejected = expect(result).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(200);
    await rejected;

    expect(onError).toHaveBeenCalled();
    expect(api.exec).toHaveBeenCalledWith('update-task', expect.objectContaining({ _rollback: true }));
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
