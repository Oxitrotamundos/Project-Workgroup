#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createApiClient } from './apiClient';
import { buildServer } from './server';
import { loadConfig } from './config';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const client = createApiClient(config);
  const server = buildServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // IMPORTANTE: en stdio, stdout es la trama del protocolo MCP; los diagnósticos van a stderr.
  console.error(`pwg-mcp conectado (API: ${config.baseUrl})`);
}

main().catch((err) => {
  console.error('pwg-mcp error fatal:', err);
  process.exit(1);
});
