import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApiClient, ApiError } from './apiClient';

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('createApiClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  const client = () =>
    createApiClient({ baseUrl: 'http://api.test/', apiKey: 'pwg_secret' });

  it('lists projects and sends the bearer api key', async () => {
    fetchMock.mockResolvedValueOnce(okJson([{ id: '1', name: 'P' }]));
    const projects = await client().listProjects();
    expect(projects).toEqual([{ id: '1', name: 'P' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/v1/projects'); // slash final del baseUrl normalizado
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer pwg_secret',
    );
  });

  it('builds the users search query', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ items: [], nextCursor: null }));
    await client().searchUsers({ search: 'ana', limit: 5 });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://api.test/v1/users?search=ana&limit=5',
    );
  });

  it('translates the error envelope into an ApiError', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson(
        { error: { code: 'PROJECT_NOT_FOUND', message: 'no existe' } },
        404,
      ),
    );
    const err = await client()
      .getProject('999')
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.code).toBe('PROJECT_NOT_FOUND');
    expect(err.message).toBe('no existe');
  });

  it('falls back to statusText when the body is not the error envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('nope', { status: 500, statusText: 'Internal Server Error' }),
    );
    const err = await client()
      .getTask('1')
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.code).toBe('unknown');
  });

  it('extracts the message from the default Nest error shape', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'task not found', error: 'Not Found', statusCode: 404 }), {
        status: 404, headers: { 'content-type': 'application/json' },
      }),
    );
    const err = await client().getTask('1').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.message).toBe('task not found');
  });

  it('joins a Nest validation array into the ApiError message', async () => {
    fetchMock.mockResolvedValueOnce(
      okJson(
        {
          message: ['name should not be empty', 'color must be a string'],
          error: 'Bad Request',
          statusCode: 400,
        },
        400,
      ),
    );
    const err = await client()
      .getTask('1')
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.message).toContain('name should not be empty');
    expect(err.message).toContain('color must be a string');
  });

  it('createTask sends an Idempotency-Key and the body', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ id: '5' }, 201));
    await client().createTask('9', { name: 'X', startDate: '2026-06-01', priority: 'medium', status: 'not-started', type: 'task', color: '#fff' } as any);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/v1/projects/9/tasks');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['idempotency-key']).toMatch(/[0-9a-f-]{36}/);
  });

  it('updateTask retries once with currentVersion on TASK_VERSION_STALE', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: { code: 'TASK_VERSION_STALE', message: 'stale', currentVersion: 7 } }), { status: 409, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(okJson({ id: '1', version: 8, summariesPatched: [] }));
    const res = await client().updateTask('1', { status: 'completed', expectedVersion: 5 } as any);
    expect((res as any).version).toBe(8);
    // El segundo PATCH usa expectedVersion = currentVersion (7).
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as any).body);
    expect(secondBody.expectedVersion).toBe(7);
  });

  it('postIdempotent retries on IDEMPOTENCY_IN_PROGRESS reusing the same key', async () => {
    vi.useFakeTimers();
    try {
      fetchMock
        .mockResolvedValueOnce(
          okJson({ message: { code: 'IDEMPOTENCY_IN_PROGRESS', message: 'in progress' } }, 409),
        )
        .mockResolvedValueOnce(okJson({ id: '5' }, 201));
      const p = client().createTask('9', { name: 'X', startDate: '2026-06-01' } as any);
      await vi.runAllTimersAsync();
      const res = await p;
      expect(res).toEqual({ id: '5' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const k0 = (fetchMock.mock.calls[0][1] as any).headers['idempotency-key'];
      const k1 = (fetchMock.mock.calls[1][1] as any).headers['idempotency-key'];
      expect(k0).toBeTruthy();
      expect(k1).toBe(k0); // misma clave única en el reintento
    } finally {
      vi.useRealTimers();
    }
  });

  it('updateTask does not retry TASK_VERSION_STALE when expectedVersion is undefined', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ message: { code: 'TASK_VERSION_STALE', message: 'stale', currentVersion: 7 } }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      ),
    );
    const err = await client()
      .updateTask('1', { status: 'completed' } as any)
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('TASK_VERSION_STALE');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('propagatePreview posts without an idempotency-key', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ sourceTaskId: '20', changes: [] }));
    await client().propagatePreview('20');
    const init = fetchMock.mock.calls[0][1] as any;
    expect(init.method).toBe('POST');
    expect(init.headers).not.toHaveProperty('idempotency-key');
  });

  it('maps an aborted request to a TIMEOUT ApiError', async () => {
    fetchMock.mockRejectedValueOnce(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );
    const err = await client().listProjects().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('TIMEOUT');
  });
});
