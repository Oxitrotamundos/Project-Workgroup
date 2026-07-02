import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from './apiClient';
import { registerReadTools } from './tools/read-tools';
import { registerWriteTools } from './tools/write-tools';

export const SERVER_NAME = 'ktp';
export const SERVER_VERSION = '0.1.0';

// Construye el servidor MCP con las tools registradas. No conoce el transporte.
export function buildServer(client: ApiClient): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerReadTools(server, client);
  registerWriteTools(server, client);
  return server;
}
