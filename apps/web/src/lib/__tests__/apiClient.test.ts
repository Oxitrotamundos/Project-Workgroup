import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError, createApiClient } from '../apiClient';

describe('apiClient', () => {
  beforeEach(() => {
    (globalThis as any).fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('injects Authorization header from tokenProvider', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    (globalThis as any).fetch = fetchMock;

    const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 'abc' });
    const res = await client.get<{ ok: boolean }>('/v1/users/me');

    expect(res).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.get('authorization')).toBe('Bearer abc');
  });

  it('parses error envelope into ApiError', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'not_found', message: 'nope' } }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 't' });
    await expect(client.get('/x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'not_found',
      message: 'nope',
    });
  });

  it('returns undefined for 204 responses', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 't' });
    await expect(client.delete('/x')).resolves.toBeUndefined();
  });

  describe('enqueuePatch', () => {
    it('coalesces multiple patches to the same path into a single request', async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: '1', name: 'B', progress: 50 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      (globalThis as any).fetch = fetchMock;

      const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 't' });
      const p1 = client.enqueuePatch<{ id: string }>('/v1/tasks/1', { name: 'A' });
      const p2 = client.enqueuePatch<{ id: string }>('/v1/tasks/1', { name: 'B', progress: 50 });

      await vi.advanceTimersByTimeAsync(60);
      await Promise.all([p1, p2]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://api/v1/tasks/1');
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body)).toEqual({ name: 'B', progress: 50 });
    });

    it('keeps requests to different paths separate', async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn().mockImplementation(async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      (globalThis as any).fetch = fetchMock;

      const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 't' });
      const a = client.enqueuePatch('/v1/tasks/1', { name: 'A' });
      const b = client.enqueuePatch('/v1/tasks/2', { name: 'B' });

      await vi.advanceTimersByTimeAsync(60);
      await Promise.all([a, b]);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('flushes pending patches immediately when flushPatches is called', async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: '1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      (globalThis as any).fetch = fetchMock;

      const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 't' });
      const p = client.enqueuePatch('/v1/tasks/1', { name: 'A' });
      const flushed = client.flushPatches();

      await Promise.all([p, flushed]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('rejects all callers with the same error when the merged request fails', async () => {
      vi.useFakeTimers();
      (globalThis as any).fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'bad', message: 'no' } }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 't' });
      const p1 = client.enqueuePatch('/v1/tasks/1', { name: 'A' });
      const p2 = client.enqueuePatch('/v1/tasks/1', { progress: 50 });
      const expectations = Promise.all([
        expect(p1).rejects.toBeInstanceOf(ApiError),
        expect(p2).rejects.toBeInstanceOf(ApiError),
      ]);
      await vi.advanceTimersByTimeAsync(60);
      await expectations;
    });
  });

  describe('retries on transient errors', () => {
    it('retries GET on 503 with backoff up to 3 times', async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response('{}', { status: 503 }))
        .mockResolvedValueOnce(new Response('{}', { status: 503 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      (globalThis as any).fetch = fetchMock;

      const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 't' });
      const promise = client.get<{ ok: boolean }>('/v1/x');
      await vi.advanceTimersByTimeAsync(2000);
      await expect(promise).resolves.toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('does not retry POST without Idempotency-Key on 503', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 503 }));
      (globalThis as any).fetch = fetchMock;

      const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 't' });
      await expect(client.patch('/v1/tasks/1', { name: 'A' })).rejects.toBeInstanceOf(ApiError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('optimistic locking auto-merge', () => {
    it('uses currentVersion from envelope error and retries without GET', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { code: 'TASK_VERSION_STALE', message: 'stale', currentVersion: 5 } }), {
            status: 409,
            headers: { 'content-type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: '1', version: 6 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      (globalThis as any).fetch = fetchMock;

      const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 't' });
      const result = await client.patch<{ id: string; version: number }>('/v1/tasks/1', {
        name: 'X',
        expectedVersion: 1,
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
      expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ name: 'X', expectedVersion: 5 });
      expect(result).toEqual({ id: '1', version: 6 });
    });

    it('parses NestJS HttpException with custom-object shape (code at root)', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              code: 'TASK_VERSION_STALE',
              message: 'task has been modified by another request',
              currentVersion: 15,
            }),
            { status: 409, headers: { 'content-type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: '1', version: 16 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      (globalThis as any).fetch = fetchMock;

      const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 't' });
      const result = await client.patch<{ id: string; version: number }>('/v1/tasks/18', {
        name: 'X',
        expectedVersion: 13,
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ name: 'X', expectedVersion: 15 });
      expect(result).toEqual({ id: '1', version: 16 });
    });

    it('parses NestJS default error shape and retries with fresh version', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              statusCode: 409,
              message: { code: 'TASK_VERSION_STALE', message: 'stale', currentVersion: 8 },
              error: 'Conflict',
            }),
            { status: 409, headers: { 'content-type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: '1', version: 9 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      (globalThis as any).fetch = fetchMock;

      const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 't' });
      const result = await client.patch<{ id: string; version: number }>('/v1/tasks/1/progress', {
        progress: 50,
        expectedVersion: 1,
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ progress: 50, expectedVersion: 8 });
      expect(result).toEqual({ id: '1', version: 9 });
    });

    it('falls back to GET refetch when currentVersion is missing from the error', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { code: 'TASK_VERSION_STALE', message: 'stale' } }), {
            status: 409,
            headers: { 'content-type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: '1', version: 5 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: '1', version: 6 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      (globalThis as any).fetch = fetchMock;

      const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 't' });
      const result = await client.patch<{ id: string; version: number }>('/v1/tasks/1', {
        name: 'X',
        expectedVersion: 1,
      });

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[1][1].method).toBe('GET');
      expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ name: 'X', expectedVersion: 5 });
      expect(result).toEqual({ id: '1', version: 6 });
    });

    it('falls back to PATCH without expectedVersion when version cannot be determined', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { code: 'TASK_VERSION_STALE', message: 'stale' } }), {
            status: 409,
            headers: { 'content-type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: '1' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: '1' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      (globalThis as any).fetch = fetchMock;

      const client = createApiClient({ baseUrl: 'http://api', tokenProvider: async () => 't' });
      await client.patch('/v1/tasks/1', { name: 'X', expectedVersion: 1 });

      expect(fetchMock).toHaveBeenCalledTimes(3);
      const lastBody = JSON.parse(fetchMock.mock.calls[2][1].body);
      expect(lastBody).toEqual({ name: 'X' });
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
