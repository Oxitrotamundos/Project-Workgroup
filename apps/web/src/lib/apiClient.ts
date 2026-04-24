export class ApiError extends Error {
  readonly name = 'ApiError';
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details?: unknown) {
    super(message);
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  tokenProvider: () => Promise<string | null>;
}

export interface ApiClient {
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body: unknown, init?: RequestInit): Promise<T>;
  patch<T>(path: string, body: unknown, init?: RequestInit): Promise<T>;
  delete(path: string, init?: RequestInit): Promise<void>;
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const doFetch = async (method: string, path: string, body?: unknown, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    const token = await opts.tokenProvider();
    if (token) headers.set('authorization', `Bearer ${token}`);
    if (body !== undefined) headers.set('content-type', 'application/json');
    const res = await fetch(`${opts.baseUrl}${path}`, {
      ...init,
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let code = 'unknown';
      let msg = res.statusText;
      let details: unknown;
      const ct = res.headers.get('content-type');
      if (ct?.includes('application/json')) {
        const payload = await res.json().catch(() => ({}));
        code = payload?.error?.code ?? code;
        msg = payload?.error?.message ?? msg;
        details = payload?.error?.details;
      }
      throw new ApiError(res.status, code, msg, details);
    }
    return res;
  };

  const asJson = async <T>(res: Response): Promise<T> => {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  };

  return {
    get: async <T>(path: string, init?: RequestInit) => asJson<T>(await doFetch('GET', path, undefined, init)),
    post: async <T>(path: string, body: unknown, init?: RequestInit) => asJson<T>(await doFetch('POST', path, body, init)),
    patch: async <T>(path: string, body: unknown, init?: RequestInit) => asJson<T>(await doFetch('PATCH', path, body, init)),
    delete: async (path: string, init?: RequestInit) => { await doFetch('DELETE', path, undefined, init); },
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
