import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiError, type ReadApiClient } from '../apiClient';
import {
  formatProjectLine,
  formatTaskDetail,
  formatTaskLine,
  formatUserLine,
} from '../format';
import { filterTasks } from '../tasks-filter';
import { formatProjectOverview } from '../overview';
// Deep-import del módulo de constantes puro: evita cargar los DTOs decorados
// del barrel (que exigen reflect-metadata) preservando el anti-drift.
import {
  TASK_STATUSES,
  TASK_TYPES,
} from '@project-workgroup/shared/dist/task.constants';

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

  server.registerTool(
    'list_tasks',
    {
      title: 'List tasks',
      description:
        'Lista tareas de un proyecto con filtros opcionales (estado, tipo, asignado, rango de fechas).',
      inputSchema: {
        projectId: z.string().min(1),
        status: z.enum(TASK_STATUSES).optional().describe('Estado exacto a filtrar'),
        type: z.enum(TASK_TYPES).optional().describe('task | summary | milestone'),
        assigneeId: z.string().optional(),
        from: z
          .string()
          .optional()
          .describe('ISO date; excluye tareas que terminan antes'),
        to: z
          .string()
          .optional()
          .describe('ISO date; excluye tareas que empiezan después'),
      },
    },
    async ({ projectId, status, type, assigneeId, from, to }) => {
      try {
        const tasks = await client.listTasks(projectId);
        const filtered = filterTasks(tasks, { status, type, assigneeId, from, to });
        if (filtered.length === 0)
          return textResult('Sin tareas que cumplan el filtro.');
        const lines = filtered.map(formatTaskLine).join('\n');
        return textResult(`${filtered.length} tarea(s):\n${lines}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_project_overview',
    {
      title: 'Project overview',
      description:
        'Snapshot del proyecto: avance, conteo por estado, hitos próximos y tareas atrasadas.',
      inputSchema: { projectId: z.string().min(1) },
    },
    async ({ projectId }) => {
      try {
        const [project, tasks] = await Promise.all([
          client.getProject(projectId),
          client.listTasks(projectId),
        ]);
        return textResult(formatProjectOverview(project, tasks));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
