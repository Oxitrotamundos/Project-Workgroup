import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  TASK_STATUSES,
  TASK_TYPES,
  TASK_PRIORITIES,
} from '@project-workgroup/shared/dist/task.constants';
import type { ApiClient } from '../apiClient';
import { textResult, errorResult } from './result';

const DEFAULT_COLOR = '#64748b';

export function registerWriteTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    'create_task',
    {
      title: 'Create task',
      description:
        'Crea una tarea en un proyecto. Solo name y startDate son obligatorios; el resto tiene defaults.',
      inputSchema: {
        projectId: z.string().min(1),
        name: z.string().min(1),
        startDate: z.string().min(1).describe('ISO date'),
        endDate: z.string().optional(),
        type: z.enum(TASK_TYPES).optional(),
        priority: z.enum(TASK_PRIORITIES).optional(),
        status: z.enum(TASK_STATUSES).optional(),
        color: z.string().optional(),
        parentId: z.string().optional(),
        assigneeId: z.string().optional(),
        estimatedHours: z.string().optional().describe('Horas como string numérico'),
        description: z.string().optional(),
      },
    },
    async (a) => {
      try {
        const task = await client.createTask(a.projectId, {
          name: a.name,
          startDate: a.startDate,
          endDate: a.endDate,
          type: a.type ?? 'task',
          priority: a.priority ?? 'medium',
          status: a.status ?? 'not-started',
          color: a.color ?? DEFAULT_COLOR,
          parentId: a.parentId,
          assigneeId: a.assigneeId,
          estimatedHours: a.estimatedHours,
          description: a.description,
        });
        return textResult(
          `Tarea creada: [${task.id}] ${task.name} · ${task.type} · ${task.status} · ${task.startDate.slice(0, 10)}→${task.endDate.slice(0, 10)}`,
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'update_task',
    {
      title: 'Update task',
      description:
        'Edita una tarea existente (nombre, fechas, estado, progreso, prioridad, asignado). Usa concurrencia optimista.',
      inputSchema: {
        taskId: z.string().min(1),
        name: z.string().min(1).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        status: z.enum(TASK_STATUSES).optional(),
        priority: z.enum(TASK_PRIORITIES).optional(),
        progress: z.number().int().min(0).max(100).optional(),
        assigneeId: z.string().optional(),
        description: z.string().optional(),
        estimatedHours: z.string().optional(),
      },
    },
    async (a) => {
      try {
        // Lee la versión vigente para mandar expectedVersion (el cliente reintenta si choca).
        const current = await client.getTask(a.taskId);
        const { taskId, ...patch } = a;
        const res = await client.updateTask(taskId, {
          ...patch,
          expectedVersion: current.version,
        });
        return textResult(
          `Tarea actualizada: [${res.id}] ${res.name} · ${res.status} · progreso ${res.progress}% · v${res.version}`,
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'assign_task',
    {
      title: 'Assign task',
      description:
        'Asigna un responsable a una tarea resolviendo la persona por nombre o email.',
      inputSchema: {
        taskId: z.string().min(1),
        person: z.string().min(1).describe('Nombre o email del responsable'),
      },
    },
    async ({ taskId, person }) => {
      try {
        const page = await client.searchUsers({ search: person, limit: 10 });
        if (page.items.length === 0)
          return textResult(`No encontré a nadie que coincida con "${person}".`);
        if (page.items.length > 1) {
          const lines = page.items
            .map((u) => `- [${u.id}] ${u.displayName} <${u.email}>`)
            .join('\n');
          return textResult(
            `Hay varias coincidencias para "${person}"; vuelve a llamar con el email exacto:\n${lines}`,
          );
        }
        const user = page.items[0];
        const current = await client.getTask(taskId);
        const res = await client.updateTask(taskId, {
          assigneeId: user.id,
          expectedVersion: current.version,
        });
        return textResult(
          `Asignada [${res.id}] ${res.name} a ${user.displayName} <${user.email}>.`,
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
