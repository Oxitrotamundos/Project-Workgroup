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
