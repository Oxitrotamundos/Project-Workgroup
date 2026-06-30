import { randomUUID } from 'node:crypto';
import type {
  ProjectResponse,
  TaskResponse,
  UserResponse,
  PagedResponse,
  CreateTaskDto,
  UpdateTaskDto,
  BulkTaskUpdateItemDto,
  TaskMutationResponse,
  BulkTaskUpdateResponse,
  PropagationPreview,
  PropagationApplyItemDto,
  ImportProjectDto,
  ImportProjectResponse,
} from '@project-workgroup/shared';

// Error tipado que refleja las formas de error que devuelve el API.
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

export interface ApiClient {
  listProjects(): Promise<ProjectResponse[]>;
  getProject(id: string): Promise<ProjectResponse>;
  listTasks(projectId: string): Promise<TaskResponse[]>;
  getTask(id: string): Promise<TaskResponse>;
  searchUsers(params: {
    search?: string;
    limit?: number;
  }): Promise<PagedResponse<UserResponse>>;
  createTask(projectId: string, dto: CreateTaskDto): Promise<TaskResponse>;
  updateTask(id: string, dto: UpdateTaskDto): Promise<TaskMutationResponse>;
  bulkUpdateTasks(
    projectId: string,
    updates: BulkTaskUpdateItemDto[],
  ): Promise<BulkTaskUpdateResponse>;
  propagatePreview(taskId: string): Promise<PropagationPreview>;
  propagateApply(
    taskId: string,
    changes: PropagationApplyItemDto[],
  ): Promise<BulkTaskUpdateResponse>;
  importProject(dto: ImportProjectDto): Promise<ImportProjectResponse>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const enc = encodeURIComponent;
const REQUEST_TIMEOUT_MS = 30_000;

export function createApiClient(config: ApiClientConfig): ApiClient {
  const base = config.baseUrl.replace(/\/+$/, '');

  async function request<T>(
    method: string,
    path: string,
    opts?: { body?: unknown; idempotencyKey?: string },
  ): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${config.apiKey}`,
      accept: 'application/json',
    };
    if (opts?.body !== undefined) headers['content-type'] = 'application/json';
    if (opts?.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;
    // Aborta si el API no responde a tiempo (un POST colgado dejaría la tool colgada).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) throw await toApiError(res);
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError(
          0,
          'TIMEOUT',
          `request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // POST mutante: clave idempotente única por llamada + reintento acotado si hay un claim en curso.
  async function postIdempotent<T>(path: string, body: unknown): Promise<T> {
    const key = randomUUID();
    for (let attempt = 0; ; attempt++) {
      try {
        return await request<T>('POST', path, { body, idempotencyKey: key });
      } catch (err) {
        if (
          err instanceof ApiError &&
          err.code === 'IDEMPOTENCY_IN_PROGRESS' &&
          attempt < 2
        ) {
          await sleep(250 * (attempt + 1));
          continue;
        }
        throw err;
      }
    }
  }

  return {
    listProjects: () => request<ProjectResponse[]>('GET', '/v1/projects'),
    getProject: (id) =>
      request<ProjectResponse>('GET', `/v1/projects/${enc(id)}`),
    listTasks: (projectId) =>
      request<TaskResponse[]>('GET', `/v1/projects/${enc(projectId)}/tasks`),
    getTask: (id) => request<TaskResponse>('GET', `/v1/tasks/${enc(id)}`),
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

    createTask: (projectId, dto) =>
      postIdempotent<TaskResponse>(`/v1/projects/${enc(projectId)}/tasks`, dto),

    updateTask: async (id, dto) => {
      const path = `/v1/tasks/${enc(id)}`;
      try {
        return await request<TaskMutationResponse>('PATCH', path, { body: dto });
      } catch (err) {
        // Conflicto optimista: reintenta una vez con la versión vigente que reporta el error.
        if (
          err instanceof ApiError &&
          err.code === 'TASK_VERSION_STALE' &&
          dto.expectedVersion !== undefined
        ) {
          const fresh = (err.details as { currentVersion?: number } | undefined)
            ?.currentVersion;
          if (typeof fresh === 'number') {
            return await request<TaskMutationResponse>('PATCH', path, {
              body: { ...dto, expectedVersion: fresh },
            });
          }
        }
        throw err;
      }
    },

    bulkUpdateTasks: (projectId, updates) =>
      request<BulkTaskUpdateResponse>(
        'PATCH',
        `/v1/projects/${enc(projectId)}/tasks/bulk`,
        { body: { updates } },
      ),

    // El preview no muta: POST sin body y sin clave idempotente (se recalcula siempre).
    propagatePreview: (taskId) =>
      request<PropagationPreview>(
        'POST',
        `/v1/tasks/${enc(taskId)}/propagate-dates/preview`,
      ),

    propagateApply: (taskId, changes) =>
      postIdempotent<BulkTaskUpdateResponse>(
        `/v1/tasks/${enc(taskId)}/propagate-dates/apply`,
        { changes },
      ),

    importProject: (dto) =>
      postIdempotent<ImportProjectResponse>('/v1/projects/import', dto),
  };
}

// Traduce las 3 formas de error que devuelve el API (verificado en vivo).
async function toApiError(res: Response): Promise<ApiError> {
  let code = 'unknown';
  let message = res.statusText || `HTTP ${res.status}`;
  let details: unknown;
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    const payload = (await res.json().catch(() => undefined)) as
      | Record<string, unknown>
      | undefined;
    const envelope = payload?.error;
    const msg = payload?.message;
    if (envelope && typeof envelope === 'object') {
      // Envelope custom { error: { code, message, details? } }
      const e = envelope as {
        code?: string;
        message?: string;
        details?: unknown;
      };
      code = e.code ?? code;
      message = e.message ?? message;
      details = e.details ?? envelope;
    } else if (msg && typeof msg === 'object') {
      // La excepción llevó { code, message, ... } dentro de `message` (p. ej. TASK_VERSION_STALE)
      const m = msg as { code?: string; message?: string };
      code = m.code ?? code;
      message = m.message ?? message;
      details = msg;
    } else {
      // Forma por defecto de Nest { message, error, statusCode } (o { code, message } plano)
      if (typeof payload?.code === 'string') code = payload.code;
      if (typeof msg === 'string') message = msg;
      details = payload;
    }
  }
  return new ApiError(res.status, code, message, details);
}
