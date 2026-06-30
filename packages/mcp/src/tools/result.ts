import { ApiError } from '../apiClient';

// Resultado de texto plano para el chat.
export function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

// Traduce cualquier fallo a un resultado de error legible (isError marca fallo de la tool).
export function errorResult(err: unknown) {
  const text =
    err instanceof ApiError
      ? `Error ${err.status} (${err.code}): ${err.message}`
      : `Error inesperado: ${(err as Error)?.message ?? String(err)}`;
  return { content: [{ type: 'text' as const, text }], isError: true };
}
