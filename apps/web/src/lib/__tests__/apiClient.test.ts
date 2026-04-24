import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, createApiClient } from '../apiClient';

describe('apiClient', () => {
  beforeEach(() => {
    (globalThis as any).fetch = vi.fn();
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
});
