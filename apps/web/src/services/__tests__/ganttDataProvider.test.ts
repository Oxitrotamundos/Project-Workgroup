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
