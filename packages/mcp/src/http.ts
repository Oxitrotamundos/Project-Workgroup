import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createApiClient } from './apiClient';
import { buildServer } from './server';

export interface McpHttpOptions {
  baseUrl: string; // base para las llamadas del MCP a /v1 (loopback)
  token: string; // JWT OAuth del request; se reenvía como Bearer a /v1
}

// Modo stateless: cada request construye su McpServer con la credencial del usuario. El apiClient
// reenvía el JWT a /v1, donde los guards del API aplican permisos (el MCP no los reimplementa).
export async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
  opts: McpHttpOptions,
): Promise<void> {
  const client = createApiClient({ baseUrl: opts.baseUrl, apiKey: opts.token });
  const server = buildServer(client);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: sin sesión persistente entre requests
  });
  res.on('close', () => {
    void transport.close?.();
    void server.close?.();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}
