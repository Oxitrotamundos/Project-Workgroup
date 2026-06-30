// Punto de entrada público del paquete. Se irá poblando en las siguientes tareas.
export const PACKAGE_NAME = '@project-workgroup/mcp';
export { createApiClient, ApiError } from './apiClient';
export type { ApiClientConfig, ReadApiClient } from './apiClient';
export { buildServer, SERVER_NAME, SERVER_VERSION } from './server';
