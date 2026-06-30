import { describe, it, expect, vi } from 'vitest';
import { registerReadTools } from './read-tools';
import { ApiError, type ReadApiClient } from '../apiClient';

// Doble de McpServer: guarda los handlers por nombre para invocarlos en el test.
function makeServerSpy() {
  const handlers = new Map<string, (args: any) => Promise<any>>();
  const server = {
    registerTool: (name: string, _config: unknown, handler: (args: any) => Promise<any>) => {
      handlers.set(name, handler);
    },
  };
  return { server: server as any, handlers };
}

const clientStub = (over: Partial<ReadApiClient> = {}): ReadApiClient => ({
  listProjects: vi.fn().mockResolvedValue([]),
  getProject: vi.fn(),
  listTasks: vi.fn(),
  getTask: vi.fn(),
  searchUsers: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  ...over,
});

describe('registerReadTools — simple tools', () => {
  it('list_projects renders a project list', async () => {
    const client = clientStub({
      listProjects: vi.fn().mockResolvedValue([
        {
          id: '7',
          name: 'KTP',
          status: 'active',
          startDate: '2026-04-01',
          endDate: '2026-08-01',
        },
      ]),
    });
    const { server, handlers } = makeServerSpy();
    registerReadTools(server, client);
    const res = await handlers.get('list_projects')!({});
    expect(res.content[0].text).toContain('[7] KTP');
    expect(res.content[0].text).toContain('active');
  });

  it('get_task renders task detail', async () => {
    const client = clientStub({
      getTask: vi.fn().mockResolvedValue({
        id: '12',
        name: 'App Check',
        type: 'task',
        status: 'completed',
        priority: 'high',
        startDate: '2026-05-26',
        endDate: '2026-05-28',
        progress: 100,
        assigneeId: null,
        tags: ['security'],
      }),
    });
    const { server, handlers } = makeServerSpy();
    registerReadTools(server, client);
    const res = await handlers.get('get_task')!({ taskId: '12' });
    expect(res.content[0].text).toContain('[12] App Check');
    expect(res.content[0].text).toContain('security');
  });

  it('find_person renders matches', async () => {
    const client = clientStub({
      searchUsers: vi.fn().mockResolvedValue({
        items: [
          {
            id: '3',
            displayName: 'Ana Díaz',
            email: 'ana@ktp.io',
            role: 'pm',
            avatarUrl: null,
          },
        ],
        nextCursor: null,
      }),
    });
    const { server, handlers } = makeServerSpy();
    registerReadTools(server, client);
    const res = await handlers.get('find_person')!({ query: 'ana' });
    expect(res.content[0].text).toContain('Ana Díaz');
    expect(res.content[0].text).toContain('ana@ktp.io');
  });

  it('translates an ApiError into an isError result', async () => {
    const client = clientStub({
      getTask: vi
        .fn()
        .mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'sin permiso')),
    });
    const { server, handlers } = makeServerSpy();
    registerReadTools(server, client);
    const res = await handlers.get('get_task')!({ taskId: '1' });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('403');
    expect(res.content[0].text).toContain('sin permiso');
  });
});

describe('registerReadTools — list_tasks & overview', () => {
  it('list_tasks applies the status filter', async () => {
    const client = clientStub({
      listTasks: vi.fn().mockResolvedValue([
        { id: '1', name: 'a', type: 'task', status: 'completed', progress: 100, assigneeId: null, startDate: '2026-06-01T00:00:00.000Z', endDate: '2026-06-02T00:00:00.000Z' },
        { id: '2', name: 'b', type: 'task', status: 'in-progress', progress: 10, assigneeId: null, startDate: '2026-06-01T00:00:00.000Z', endDate: '2026-06-02T00:00:00.000Z' },
      ]),
    });
    const { server, handlers } = makeServerSpy();
    registerReadTools(server, client);
    const res = await handlers.get('list_tasks')!({ projectId: '9', status: 'completed' });
    expect(res.content[0].text).toContain('[1] a');
    expect(res.content[0].text).not.toContain('[2] b');
  });

  it('get_project_overview fetches project + tasks and renders a snapshot', async () => {
    const client = clientStub({
      getProject: vi.fn().mockResolvedValue({ id: '9', name: 'KTP', status: 'active', startDate: '2026-04-01', endDate: '2026-08-01' }),
      listTasks: vi.fn().mockResolvedValue([]),
    });
    const { server, handlers } = makeServerSpy();
    registerReadTools(server, client);
    const res = await handlers.get('get_project_overview')!({ projectId: '9' });
    expect(res.content[0].text).toContain('[9] KTP');
    expect(client.getProject).toHaveBeenCalledWith('9');
    expect(client.listTasks).toHaveBeenCalledWith('9');
  });
});
