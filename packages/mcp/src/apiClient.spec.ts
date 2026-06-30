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
});
