import { describe, it, expect, vi } from 'vitest';
import { registerWriteTools } from './write-tools';
import { ApiError, type ApiClient } from '../apiClient';

function makeServerSpy() {
  const handlers = new Map<string, (a: any) => Promise<any>>();
  return { server: { registerTool: (n: string, _c: unknown, h: any) => handlers.set(n, h) } as any, handlers };
}
const clientStub = (over: Partial<ApiClient> = {}): ApiClient => ({
  listProjects: vi.fn(), getProject: vi.fn(), listTasks: vi.fn(),
  getTask: vi.fn(), searchUsers: vi.fn(),
  createTask: vi.fn(), updateTask: vi.fn(), bulkUpdateTasks: vi.fn(),
  propagatePreview: vi.fn(), propagateApply: vi.fn(), importProject: vi.fn(),
  ...over,
});

describe('registerWriteTools — fine tools', () => {
  it('create_task applies defaults and returns a summary', async () => {
    const createTask = vi.fn().mockResolvedValue({ id: '88', name: 'New', status: 'not-started', type: 'task', startDate: '2026-06-01T00:00:00Z', endDate: '2026-06-02T00:00:00Z', priority: 'medium', progress: 0, assigneeId: null, tags: [] });
    const { server, handlers } = makeServerSpy();
    registerWriteTools(server, clientStub({ createTask }));
    const res = await handlers.get('create_task')!({ projectId: '9', name: 'New', startDate: '2026-06-01' });
    expect(createTask).toHaveBeenCalled();
    const dto = createTask.mock.calls[0][1];
    expect(dto).toMatchObject({ name: 'New', type: 'task', status: 'not-started', priority: 'medium' });
    expect(dto.color).toBeTruthy();
    expect(res.content[0].text).toContain('[88]');
  });

  it('update_task reads the current version then patches with expectedVersion', async () => {
    const getTask = vi.fn().mockResolvedValue({ id: '5', version: 4, name: 'T', status: 'not-started', type: 'task', startDate: '2026-06-01T00:00:00Z', endDate: '2026-06-02T00:00:00Z', priority: 'low', progress: 0, assigneeId: null, tags: [] });
    const updateTask = vi.fn().mockResolvedValue({ id: '5', version: 5, status: 'in-progress', summariesPatched: [] });
    const { server, handlers } = makeServerSpy();
    registerWriteTools(server, clientStub({ getTask, updateTask }));
    await handlers.get('update_task')!({ taskId: '5', status: 'in-progress' });
    expect(updateTask.mock.calls[0][1]).toMatchObject({ status: 'in-progress', expectedVersion: 4 });
  });

  it('assign_task resolves a single person and assigns', async () => {
    const searchUsers = vi.fn().mockResolvedValue({ items: [{ id: '3', displayName: 'Ana', email: 'ana@x', role: 'pm', avatarUrl: null }], nextCursor: null });
    const getTask = vi.fn().mockResolvedValue({ id: '5', version: 2 });
    const updateTask = vi.fn().mockResolvedValue({ id: '5', version: 3, assigneeId: '3', summariesPatched: [] });
    const { server, handlers } = makeServerSpy();
    registerWriteTools(server, clientStub({ searchUsers, getTask, updateTask }));
    const res = await handlers.get('assign_task')!({ taskId: '5', person: 'ana' });
    expect(updateTask.mock.calls[0][1]).toMatchObject({ assigneeId: '3', expectedVersion: 2 });
    expect(res.content[0].text).toContain('Ana');
  });

  it('assign_task lists candidates when the query is ambiguous', async () => {
    const searchUsers = vi.fn().mockResolvedValue({ items: [{ id: '3', displayName: 'Ana Uno', email: 'a1@x', role: 'pm', avatarUrl: null }, { id: '4', displayName: 'Ana Dos', email: 'a2@x', role: 'member', avatarUrl: null }], nextCursor: null });
    const { server, handlers } = makeServerSpy();
    registerWriteTools(server, clientStub({ searchUsers }));
    const res = await handlers.get('assign_task')!({ taskId: '5', person: 'ana' });
    expect(res.content[0].text).toContain('varias');
    expect(res.content[0].text).toContain('a1@x');
  });
});

describe('daily_update', () => {
  const tasksFixture = [
    { id: '10', name: 'Diseño', version: 2, status: 'not-started', progress: 0, description: '' },
    { id: '11', name: 'API', version: 5, status: 'in-progress', progress: 20, description: '' },
  ];
  it('resolves refs by id or name and bulk-updates with per-item expectedVersion', async () => {
    const listTasks = vi.fn().mockResolvedValue(tasksFixture);
    const bulkUpdateTasks = vi.fn().mockResolvedValue({ tasks: [{ id: '10' }, { id: '11' }], summariesPatched: [] });
    const { server, handlers } = makeServerSpy();
    registerWriteTools(server, clientStub({ listTasks, bulkUpdateTasks }));
    const res = await handlers.get('daily_update')!({
      projectId: '9',
      updates: [
        { taskRef: '10', progress: 50 },
        { taskRef: 'API', status: 'completed' },
      ],
    });
    const sent = bulkUpdateTasks.mock.calls[0][1];
    expect(sent).toEqual([
      { id: '10', data: { progress: 50 }, expectedVersion: 2 },
      { id: '11', data: { status: 'completed' }, expectedVersion: 5 },
    ]);
    expect(res.content[0].text).toContain('2 tarea(s)');
  });

  it('reports an unresolved ref without calling the API', async () => {
    const listTasks = vi.fn().mockResolvedValue(tasksFixture);
    const bulkUpdateTasks = vi.fn();
    const { server, handlers } = makeServerSpy();
    registerWriteTools(server, clientStub({ listTasks, bulkUpdateTasks }));
    const res = await handlers.get('daily_update')!({ projectId: '9', updates: [{ taskRef: 'Inexistente', progress: 10 }] });
    expect(bulkUpdateTasks).not.toHaveBeenCalled();
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Inexistente');
  });

  it('on TASK_VERSION_STALE refreshes versions and retries once, succeeding', async () => {
    const bumpedFixture = [
      { id: '10', name: 'Diseño', version: 7, status: 'not-started', progress: 0, description: '' },
      { id: '11', name: 'API', version: 9, status: 'in-progress', progress: 20, description: '' },
    ];
    const listTasks = vi
      .fn()
      .mockResolvedValueOnce(tasksFixture)
      .mockResolvedValueOnce(bumpedFixture);
    const bulkUpdateTasks = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(409, 'TASK_VERSION_STALE', 'stale'))
      .mockResolvedValueOnce({ tasks: [{ id: '10' }, { id: '11' }], summariesPatched: [] });
    const { server, handlers } = makeServerSpy();
    registerWriteTools(server, clientStub({ listTasks, bulkUpdateTasks }));
    const res = await handlers.get('daily_update')!({
      projectId: '9',
      updates: [
        { taskRef: '10', progress: 50 },
        { taskRef: 'API', status: 'completed' },
      ],
    });
    expect(bulkUpdateTasks).toHaveBeenCalledTimes(2);
    const retried = bulkUpdateTasks.mock.calls[1][1];
    expect(retried).toEqual([
      { id: '10', data: { progress: 50 }, expectedVersion: 7 },
      { id: '11', data: { status: 'completed' }, expectedVersion: 9 },
    ]);
    expect(res.content[0].text).toContain('tras refrescar versiones');
  });

  it('propagates a second TASK_VERSION_STALE without looping forever', async () => {
    const listTasks = vi.fn().mockResolvedValue(tasksFixture);
    const bulkUpdateTasks = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(409, 'TASK_VERSION_STALE', 'stale'))
      .mockRejectedValueOnce(new ApiError(409, 'TASK_VERSION_STALE', 'stale again'));
    const { server, handlers } = makeServerSpy();
    registerWriteTools(server, clientStub({ listTasks, bulkUpdateTasks }));
    const res = await handlers.get('daily_update')!({
      projectId: '9',
      updates: [{ taskRef: '10', progress: 50 }],
    });
    expect(bulkUpdateTasks).toHaveBeenCalledTimes(2);
    expect(res.isError).toBe(true);
  });

  it('ignores a whitespace-only note (does not modify the description)', async () => {
    const listTasks = vi.fn().mockResolvedValue(tasksFixture);
    const bulkUpdateTasks = vi.fn().mockResolvedValue({ tasks: [{ id: '10' }], summariesPatched: [] });
    const { server, handlers } = makeServerSpy();
    registerWriteTools(server, clientStub({ listTasks, bulkUpdateTasks }));
    await handlers.get('daily_update')!({
      projectId: '9',
      updates: [{ taskRef: '10', note: '   ' }],
    });
    const sent = bulkUpdateTasks.mock.calls[0][1];
    expect(sent[0].data).not.toHaveProperty('description');
  });
});

describe('reschedule_task / apply_reschedule', () => {
  it('moves the source then returns the downstream cascade preview', async () => {
    const getTask = vi.fn().mockResolvedValue({ id: '20', name: 'Fuente', version: 3 });
    const updateTask = vi.fn().mockResolvedValue({ id: '20', version: 4, summariesPatched: [] });
    const propagatePreview = vi.fn().mockResolvedValue({ sourceTaskId: '20', changes: [{ taskId: '21', currentVersion: 1, currentStartDate: '2026-06-01', currentEndDate: '2026-06-03', proposedStartDate: '2026-06-05', proposedEndDate: '2026-06-07', via: 'e2s', fromTaskId: '20' }] });
    const { server, handlers } = makeServerSpy();
    registerWriteTools(server, clientStub({ getTask, updateTask, propagatePreview }));
    const res = await handlers.get('reschedule_task')!({ taskId: '20', startDate: '2026-06-04', endDate: '2026-06-05' });
    expect(updateTask.mock.calls[0][1]).toMatchObject({ startDate: '2026-06-04', endDate: '2026-06-05', expectedVersion: 3 });
    // El preview se calcula desde las fechas ya guardadas: el movimiento debe ir antes.
    expect(updateTask.mock.invocationCallOrder[0]).toBeLessThan(propagatePreview.mock.invocationCallOrder[0]);
    expect(res.content[0].text).toContain('[21]');
    expect(res.content[0].text).toContain('apply_reschedule');
  });

  it('reschedule_task still commits the move but reports no dependents when the preview is empty', async () => {
    const getTask = vi.fn().mockResolvedValue({ id: '20', version: 3 });
    const updateTask = vi.fn().mockResolvedValue({ id: '20', version: 4, summariesPatched: [] });
    const propagatePreview = vi.fn().mockResolvedValue({ sourceTaskId: '20', changes: [] });
    const { server, handlers } = makeServerSpy();
    registerWriteTools(server, clientStub({ getTask, updateTask, propagatePreview }));
    const res = await handlers.get('reschedule_task')!({ taskId: '20', startDate: '2026-06-04', endDate: '2026-06-05' });
    expect(updateTask).toHaveBeenCalled();
    expect(res.content[0].text).toContain('No hay dependientes');
    expect(res.content[0].text).not.toContain('apply_reschedule');
  });

  it('apply_reschedule maps the preview changes into the apply call', async () => {
    const propagatePreview = vi.fn().mockResolvedValue({ sourceTaskId: '20', changes: [{ taskId: '21', currentVersion: 1, currentStartDate: '2026-06-01', currentEndDate: '2026-06-03', proposedStartDate: '2026-06-05', proposedEndDate: '2026-06-07', via: 'e2s', fromTaskId: '20' }] });
    const propagateApply = vi.fn().mockResolvedValue({ tasks: [{ id: '21' }], summariesPatched: [] });
    const { server, handlers } = makeServerSpy();
    registerWriteTools(server, clientStub({ propagatePreview, propagateApply }));
    const res = await handlers.get('apply_reschedule')!({ taskId: '20' });
    expect(propagateApply.mock.calls[0][1]).toEqual([
      { taskId: '21', startDate: '2026-06-05', endDate: '2026-06-07', expectedVersion: 1 },
    ]);
    expect(res.content[0].text).toContain('1 tarea(s)');
  });

  it('apply_reschedule reports when there is nothing to cascade', async () => {
    const propagatePreview = vi.fn().mockResolvedValue({ sourceTaskId: '20', changes: [] });
    const propagateApply = vi.fn();
    const { server, handlers } = makeServerSpy();
    registerWriteTools(server, clientStub({ propagatePreview, propagateApply }));
    const res = await handlers.get('apply_reschedule')!({ taskId: '20' });
    expect(propagateApply).not.toHaveBeenCalled();
    expect(res.content[0].text).toContain('Nada que propagar');
  });
});

describe('plan_project', () => {
  it('maps input to the import DTO, defaults colors, and folds assigneeNote into description', async () => {
    const importProject = vi.fn().mockResolvedValue({ project: { id: '30', name: 'Nuevo' }, taskRefToId: { a: '40', b: '41' }, taskCount: 2, dependencyCount: 1 });
    const { server, handlers } = makeServerSpy();
    registerWriteTools(server, clientStub({ importProject }));
    const res = await handlers.get('plan_project')!({
      project: { name: 'Nuevo', startDate: '2026-07-01', endDate: '2026-09-01' },
      tasks: [
        { ref: 'a', name: 'Frente', type: 'summary', startDate: '2026-07-01', endDate: '2026-07-10' },
        { ref: 'b', name: 'Tarea', type: 'task', startDate: '2026-07-02', endDate: '2026-07-05', parentRef: 'a', assigneeNote: 'Dani (sin alta)' },
      ],
      dependencies: [{ fromRef: 'a', toRef: 'b', type: 'e2s' }],
    });
    const dto = importProject.mock.calls[0][0];
    expect(dto.project).toMatchObject({ name: 'Nuevo', status: 'planning' });
    expect(dto.project.color).toBeTruthy();
    expect(dto.tasks[1].description).toContain('Dani');
    expect(dto.tasks[0].color).toBeTruthy();
    expect(res.content[0].text).toContain('30');
    expect(res.content[0].text).toContain('2 tarea');
  });
});
