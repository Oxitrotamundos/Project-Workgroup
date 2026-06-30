import type {
  ProjectResponse,
  TaskResponse,
  UserResponse,
  PagedResponse,
} from '@project-workgroup/shared';

// Error tipado que refleja el envelope { error: { code, message, details? } } del API.
export class ApiError extends Error {
  override readonly name = 'ApiError';
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface ApiClientConfig {
  baseUrl: string; // p. ej. http://localhost:3000 (con o sin slash final)
  apiKey: string; // credencial pwg_... enviada como Bearer
}

export interface ReadApiClient {
  listProjects(): Promise<ProjectResponse[]>;
  getProject(id: string): Promise<ProjectResponse>;
  listTasks(projectId: string): Promise<TaskResponse[]>;
  getTask(id: string): Promise<TaskResponse>;
  searchUsers(params: {
    search?: string;
    limit?: number;
  }): Promise<PagedResponse<UserResponse>>;
}

export function createApiClient(config: ApiClientConfig): ReadApiClient {
  const base = config.baseUrl.replace(/\/+$/, '');

  async function request<T>(method: string, path: string): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        accept: 'application/json',
      },
    });
    if (!res.ok) throw await toApiError(res);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    listProjects: () => request<ProjectResponse[]>('GET', '/v1/projects'),
    getProject: (id) =>
      request<ProjectResponse>('GET', `/v1/projects/${encodeURIComponent(id)}`),
    listTasks: (projectId) =>
      request<TaskResponse[]>(
        'GET',
        `/v1/projects/${encodeURIComponent(projectId)}/tasks`,
      ),
    getTask: (id) =>
      request<TaskResponse>('GET', `/v1/tasks/${encodeURIComponent(id)}`),
    searchUsers: ({ search, limit }) => {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (limit !== undefined) qs.set('limit', String(limit));
      const query = qs.toString();
      return request<PagedResponse<UserResponse>>(
        'GET',
        `/v1/users${query ? `?${query}` : ''}`,
      );
    },
  };
}

// Traduce una respuesta HTTP de error al tipo ApiError, leyendo el envelope si está.
async function toApiError(res: Response): Promise<ApiError> {
  let code = 'unknown';
  let message = res.statusText || `HTTP ${res.status}`;
  let details: unknown;
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    const payload = (await res.json().catch(() => undefined)) as
      | { error?: { code?: string; message?: string; details?: unknown } }
      | undefined;
    const envelope = payload?.error;
    if (envelope && typeof envelope === 'object') {
      code = envelope.code ?? code;
      message = envelope.message ?? message;
      details = envelope.details ?? envelope;
    }
  }
  return new ApiError(res.status, code, message, details);
}
