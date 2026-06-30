import type { ApiClientConfig } from './apiClient';

// Lee la configuración del entorno para el modo stdio local.
export function loadConfig(env: NodeJS.ProcessEnv): ApiClientConfig {
  const baseUrl = env.PWG_API_URL?.trim();
  const apiKey = env.PWG_API_KEY?.trim();
  if (!baseUrl) throw new Error('PWG_API_URL no está definida');
  if (!apiKey) throw new Error('PWG_API_KEY no está definida');
  return { baseUrl, apiKey };
}
