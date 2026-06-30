import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiError, type ReadApiClient } from '../apiClient';
import {
  formatProjectLine,
  formatTaskDetail,
  formatUserLine,
} from '../format';

// Resultado de texto plano para el chat.
function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

// Traduce cualquier fallo a un resultado de error legible (isError marca fallo de la tool).
function errorResult(err: unknown) {
  const text =
    err instanceof ApiError
      ? `Error ${err.status} (${err.code}): ${err.message}`
      : `Error inesperado: ${(err as Error)?.message ?? String(err)}`;
  return { content: [{ type: 'text' as const, text }], isError: true };
}

export function registerReadTools(
  server: McpServer,
  client: ReadApiClient,
): void {
  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description: 'Lista los proyectos visibles para el usuario autenticado.',
      inputSchema: {},
    },
    async () => {
      try {
        const projects = await client.listProjects();
        if (projects.length === 0) return textResult('No tienes proyectos.');
        const lines = projects.map(formatProjectLine).join('\n');
        return textResult(`${projects.length} proyecto(s):\n${lines}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_task',
    {
      title: 'Get task',
      description: 'Devuelve el detalle de una tarea por su id.',
      inputSchema: { taskId: z.string().min(1).describe('ID de la tarea') },
    },
    async ({ taskId }) => {
      try {
        return textResult(formatTaskDetail(await client.getTask(taskId)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'find_person',
    {
      title: 'Find person',
      description:
        'Busca usuarios por nombre o email (soporte para asignar tareas).',
      inputSchema: {
        query: z.string().min(1).describe('Texto a buscar (nombre o email)'),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ query, limit }) => {
      try {
        const page = await client.searchUsers({ search: query, limit });
        if (page.items.length === 0)
          return textResult(`Sin coincidencias para "${query}".`);
        const lines = page.items.map(formatUserLine).join('\n');
        return textResult(`${page.items.length} persona(s):\n${lines}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
