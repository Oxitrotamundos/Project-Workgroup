export class ApiError extends Error {
  readonly name = 'ApiError';
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details?: unknown) {
    super(message);
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  tokenProvider: () => Promise<string | null>;
  patchDebounceMs?: number;
}

export interface ApiClient {
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body: unknown, init?: RequestInit): Promise<T>;
  patch<T>(path: string, body: unknown, init?: RequestInit): Promise<T>;
  delete(path: string, init?: RequestInit): Promise<void>;

  enqueuePatch<T>(path: string, body: Record<string, unknown>): Promise<T>;
  flushPatches(): Promise<void>;
}

interface PendingPatch {
  merged: Record<string, unknown>;
  resolvers: Array<{ resolve: (value: unknown) => void; reject: (err: unknown) => void }>;
  timer: ReturnType<typeof setTimeout> | null;
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const debounceMs = opts.patchDebounceMs ?? 50;

  const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
  const RETRYABLE_STATUS = new Set([502, 503, 504]);
  const MAX_RETRIES = 3;
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const computeBackoff = (attempt: number): number => {
    const base = 200 * Math.pow(2, attempt);
    return base + Math.round((Math.random() - 0.5) * 100);
  };

  const performFetch = async (method: string, path: string, body: unknown, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    const token = await opts.tokenProvider();
    if (token) headers.set('authorization', `Bearer ${token}`);
    if (body !== undefined) headers.set('content-type', 'application/json');
    return fetch(`${opts.baseUrl}${path}`, {
      ...init,
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  const isMethodRetryable = (method: string, init?: RequestInit): boolean => {
    if (SAFE_METHODS.has(method)) return true;
    const headers = new Headers(init?.headers);
    return headers.has('idempotency-key');
  };

  const doFetch = async (method: string, path: string, body?: unknown, init?: RequestInit): Promise<Response> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await performFetch(method, path, body, init);
        if (res.ok) return res;

        if (
          attempt < MAX_RETRIES &&
          isMethodRetryable(method, init) &&
          (RETRYABLE_STATUS.has(res.status) || res.status === 429)
        ) {
          const retryAfter = res.headers.get('retry-after');
          const wait = retryAfter ? Math.min(Number(retryAfter) * 1000, 10_000) : computeBackoff(attempt);
          if (Number.isFinite(wait) && wait > 0) await sleep(wait);
          continue;
        }

        let code = 'unknown';
        let msg = res.statusText;
        let details: unknown;
        const ct = res.headers.get('content-type');
        if (ct?.includes('application/json')) {
          const payload = await res.json().catch(() => ({}));

          if (payload?.error && typeof payload.error === 'object') {
            code = payload.error.code ?? code;
            msg = payload.error.message ?? msg;
            details = payload.error.details ?? payload.error;
          }

          if (payload?.message && typeof payload.message === 'object') {
            code = payload.message.code ?? code;
            msg = payload.message.message ?? msg;
            details = payload.message;
          }

          if (typeof payload?.code === 'string' && code === 'unknown') {
            code = payload.code;
            if (typeof payload.message === 'string') msg = payload.message;
            details = payload;
          } else if (typeof payload?.message === 'string' && msg === res.statusText) {
            msg = payload.message;
          }
        }
        throw new ApiError(res.status, code, msg, details);
      } catch (err) {
        if (err instanceof ApiError) throw err;
        lastErr = err;
        if (attempt < MAX_RETRIES && isMethodRetryable(method, init)) {
          await sleep(computeBackoff(attempt));
          continue;
        }
        throw err;
      }
    }
    throw lastErr ?? new Error('apiClient: retries exhausted');
  };

  const asJson = async <T>(res: Response): Promise<T> => {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  };

  const TASK_BASE_RE = /^(\/v1\/tasks\/[^/]+)/;
  const refetchVersion = async (path: string): Promise<number | null> => {
    const match = TASK_BASE_RE.exec(path);
    if (!match) return null;
    try {
      const data = await asJson<any>(await doFetch('GET', match[1]));
      return typeof data?.version === 'number' ? data.version : null;
    } catch {
      return null;
    }
  };

  const isVersionStale = (err: unknown): err is ApiError =>
    err instanceof ApiError &&
    err.status === 409 &&
    (err.code === 'TASK_VERSION_STALE' || err.code === 'TASK_LINK_VERSION_STALE');

  const patchRaw = async <T>(path: string, body: unknown, init?: RequestInit) =>
    asJson<T>(await doFetch('PATCH', path, body, init));

  const versionFromError = (err: ApiError): number | null => {
    const details = err.details as { currentVersion?: unknown } | undefined;
    return typeof details?.currentVersion === 'number' ? details.currentVersion : null;
  };

  const stripExpectedVersion = (body: Record<string, unknown>): Record<string, unknown> => {
    const { expectedVersion: _ignore, ...rest } = body;
    return rest;
  };

  const patchWithVersionRetry = async <T>(
    path: string,
    body: Record<string, unknown>,
    init?: RequestInit,
  ): Promise<T> => {
    try {
      return await patchRaw<T>(path, body, init);
    } catch (err) {
      if (!isVersionStale(err)) throw err;

      const inlineVersion = versionFromError(err);
      const fresh = inlineVersion ?? (await refetchVersion(path));

      if (fresh !== null && typeof body.expectedVersion === 'number') {
        return patchRaw<T>(path, { ...body, expectedVersion: fresh }, init);
      }

      console.warn('[apiClient] auto-merge fallback: retrying PATCH without expectedVersion', {
        path,
        hadInline: inlineVersion !== null,
        hadExpected: typeof body.expectedVersion === 'number',
      });
      return patchRaw<T>(path, stripExpectedVersion(body), init);
    }
  };

  const pending = new Map<string, PendingPatch>();

  const flushOne = async (path: string): Promise<void> => {
    const entry = pending.get(path);
    if (!entry) return;
    pending.delete(path);
    if (entry.timer !== null) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    try {
      const result = await patchWithVersionRetry<unknown>(path, entry.merged);
      entry.resolvers.forEach(r => r.resolve(result));
    } catch (err) {
      entry.resolvers.forEach(r => r.reject(err));
    }
  };

  const enqueuePatch = <T>(path: string, body: Record<string, unknown>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const existing = pending.get(path);
      if (existing) {
        Object.assign(existing.merged, body);
        existing.resolvers.push({ resolve: resolve as (v: unknown) => void, reject });
        if (existing.timer !== null) clearTimeout(existing.timer);
        existing.timer = setTimeout(() => { void flushOne(path); }, debounceMs);
        return;
      }
      const entry: PendingPatch = {
        merged: { ...body },
        resolvers: [{ resolve: resolve as (v: unknown) => void, reject }],
        timer: null,
      };
      entry.timer = setTimeout(() => { void flushOne(path); }, debounceMs);
      pending.set(path, entry);
    });
  };

  const flushPatches = async (): Promise<void> => {
    const paths = Array.from(pending.keys());
    await Promise.all(paths.map(p => flushOne(p)));
  };

  const withIdempotencyKey = (init?: RequestInit): RequestInit => {
    const headers = new Headers(init?.headers);
    if (!headers.has('idempotency-key')) {
      const uuid = typeof crypto !== 'undefined'
        ? ('randomUUID' in crypto
            ? crypto.randomUUID()
            : (() => {
                const bytes = new Uint8Array(16);
                crypto.getRandomValues(bytes);
                bytes[6] = (bytes[6] & 0x0f) | 0x40;
                bytes[8] = (bytes[8] & 0x3f) | 0x80;
                const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
                return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
              })())
        : `${Date.now().toString(36)}-idempotency-key`;
      headers.set('idempotency-key', uuid);
    }
    return { ...init, headers };
  };

  return {
    get: async <T>(path: string, init?: RequestInit) => asJson<T>(await doFetch('GET', path, undefined, init)),
    post: async <T>(path: string, body: unknown, init?: RequestInit) =>
      asJson<T>(await doFetch('POST', path, body, withIdempotencyKey(init))),
    patch: <T>(path: string, body: unknown, init?: RequestInit) => {
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        return patchWithVersionRetry<T>(path, body as Record<string, unknown>, init);
      }
      return patchRaw<T>(path, body, init);
    },
    delete: async (path: string, init?: RequestInit) => { await doFetch('DELETE', path, undefined, init); },
    enqueuePatch,
    flushPatches,
  };
}

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function firebaseIdTokenProvider(): Promise<string | null> {
  const { getAuth } = await import('firebase/auth');
  const user = getAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export const apiClient = createApiClient({ baseUrl, tokenProvider: firebaseIdTokenProvider });
