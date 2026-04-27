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
});
