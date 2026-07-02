// Punto de entrada público del paquete. Se irá poblando en las siguientes tareas.
export const PACKAGE_NAME = '@project-workgroup/mcp';
export { createApiClient, ApiError } from './apiClient';
export type { ApiClientConfig, ApiClient } from './apiClient';
export { buildServer, SERVER_NAME, SERVER_VERSION } from './server';
export { handleMcpRequest } from './http';
export type { McpHttpOptions } from './http';
