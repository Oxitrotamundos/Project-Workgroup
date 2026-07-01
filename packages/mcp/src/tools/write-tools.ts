import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  TASK_STATUSES,
  TASK_TYPES,
  TASK_PRIORITIES,
} from '@project-workgroup/shared/dist/task.constants';
import type {
  UpdateTaskDto,
  ImportProjectDto,
  ProjectStatus,
  ImportLinkType,
} from '@project-workgroup/shared';
import { ApiError, type ApiClient } from '../apiClient';
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

  server.registerTool(
    'daily_update',
    {
      title: 'Daily update',
      description:
        'Actualiza progreso/estado de varias tareas de un proyecto en lote (resuelve refs por id o nombre).',
      inputSchema: {
        projectId: z.string().min(1),
        updates: z
          .array(
            z.object({
              taskRef: z.string().min(1).describe('id exacto o nombre de la tarea'),
              progress: z.number().int().min(0).max(100).optional(),
              status: z.enum(TASK_STATUSES).optional(),
              note: z.string().optional().describe('Se anexa al description de la tarea'),
            }),
          )
          .min(1)
          .max(200),
      },
    },
    async ({ projectId, updates }) => {
      try {
        const tasks = await client.listTasks(projectId);
        const byId = new Map(tasks.map((t) => [t.id, t]));
        // Índice por nombre a lista: un mismo nombre puede repetirse entre tareas.
        const byName = new Map<string, typeof tasks>();
        for (const t of tasks) {
          const key = t.name.toLowerCase();
          const bucket = byName.get(key);
          if (bucket) bucket.push(t);
          else byName.set(key, [t]);
        }

        // Resolución de refs antes de tocar la API: cualquier ref no resuelta aborta.
        const resolved: { id: string; data: UpdateTaskDto; version: number }[] = [];
        for (const u of updates) {
          // El id exacto tiene prioridad y no pasa por el chequeo de ambigüedad de nombre.
          let task = byId.get(u.taskRef);
          if (!task) {
            const matches = byName.get(u.taskRef.toLowerCase()) ?? [];
            if (matches.length > 1) {
              const candidates = matches.map((t) => `[${t.id}] ${t.name}`).join(', ');
              return errorResult(
                new Error(
                  `la tarea "${u.taskRef}" es ambigua en el proyecto ${projectId}; ` +
                    `vuelve a llamar con el id exacto. Candidatos: ${candidates}`,
                ),
              );
            }
            task = matches[0];
          }
          if (!task)
            return errorResult(
              new Error(`no pude resolver la tarea "${u.taskRef}" en el proyecto ${projectId}`),
            );
          const data: UpdateTaskDto = {};
          if (u.progress !== undefined) data.progress = u.progress;
          if (u.status !== undefined) data.status = u.status;
          // Ignora notas en blanco para no ensuciar la descripción.
          if (u.note?.trim()) {
            const prev = task.description ? `${task.description}\n` : '';
            data.description = `${prev}${u.note}`;
          }
          resolved.push({ id: task.id, data, version: task.version });
        }

        const buildItems = (versionById: Map<string, number>) =>
          resolved.map((r) => ({
            id: r.id,
            data: r.data,
            expectedVersion: versionById.get(r.id) ?? r.version,
          }));

        let versionById = new Map(resolved.map((r) => [r.id, r.version]));
        try {
          const res = await client.bulkUpdateTasks(projectId, buildItems(versionById));
          return textResult(`Actualicé ${res.tasks.length} tarea(s).`);
        } catch (err) {
          // El bulk es atómico: un conflicto revierte todo. Refresca versiones y reintenta una vez.
          if (err instanceof ApiError && err.code === 'TASK_VERSION_STALE') {
            const fresh = await client.listTasks(projectId);
            versionById = new Map(fresh.map((t) => [t.id, t.version]));
            const res = await client.bulkUpdateTasks(projectId, buildItems(versionById));
            return textResult(`Actualicé ${res.tasks.length} tarea(s) (tras refrescar versiones).`);
          }
          throw err;
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'reschedule_task',
    {
      title: 'Reschedule task',
      description:
        'Mueve las fechas de una tarea y muestra qué dependientes se reprogramarían. Para aplicar la cascada, usa apply_reschedule.',
      inputSchema: {
        taskId: z.string().min(1),
        startDate: z.string().min(1).describe('Nueva fecha de inicio (ISO)'),
        endDate: z.string().min(1).describe('Nueva fecha de fin (ISO)'),
      },
    },
    async ({ taskId, startDate, endDate }) => {
      try {
        const current = await client.getTask(taskId);
        await client.updateTask(taskId, {
          startDate,
          endDate,
          expectedVersion: current.version,
        });
        const preview = await client.propagatePreview(taskId);
        if (preview.changes.length === 0)
          return textResult(
            `Moví [${taskId}] a ${startDate.slice(0, 10)}→${endDate.slice(0, 10)}. No hay dependientes que reprogramar.`,
          );
        const lines = preview.changes
          .map(
            (c) =>
              `  - [${c.taskId}] ${c.currentStartDate}→${c.currentEndDate} ⇒ ${c.proposedStartDate}→${c.proposedEndDate} (${c.via})`,
          )
          .join('\n');
        return textResult(
          `Moví [${taskId}] a ${startDate.slice(0, 10)}→${endDate.slice(0, 10)}.\n` +
            `${preview.changes.length} dependiente(s) se reprogramarían:\n${lines}\n` +
            `Llama a apply_reschedule({ taskId: "${taskId}" }) para aplicar la cascada.`,
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'apply_reschedule',
    {
      title: 'Apply reschedule',
      description:
        'Aplica la cascada de fechas a los dependientes de una tarea ya reprogramada (recalcula el preview y lo confirma).',
      inputSchema: { taskId: z.string().min(1) },
    },
    async ({ taskId }) => {
      try {
        const preview = await client.propagatePreview(taskId);
        if (preview.changes.length === 0)
          return textResult('Nada que propagar.');
        const changes = preview.changes.map((c) => ({
          taskId: c.taskId,
          startDate: c.proposedStartDate,
          endDate: c.proposedEndDate,
          expectedVersion: c.currentVersion,
        }));
        const res = await client.propagateApply(taskId, changes);
        return textResult(`Reprogramé ${res.tasks.length} tarea(s) en cascada.`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'plan_project',
    {
      title: 'Plan project',
      description:
        'Crea un proyecto completo (proyecto + tareas jerárquicas + dependencias) en una sola operación atómica.',
      inputSchema: {
        project: z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          startDate: z.string().min(1),
          endDate: z.string().min(1),
          // El server valida el valor (z.string para no extraer otro enum de shared).
          status: z.string().optional().describe('planning | active | completed | on-hold'),
          color: z.string().optional(),
        }),
        tasks: z
          .array(
            z.object({
              ref: z.string().min(1),
              name: z.string().min(1),
              type: z.enum(TASK_TYPES),
              startDate: z.string().min(1),
              endDate: z.string().optional(),
              priority: z.enum(TASK_PRIORITIES).optional(),
              status: z.enum(TASK_STATUSES).optional(),
              color: z.string().optional(),
              parentRef: z.string().optional(),
              tags: z.array(z.string()).optional(),
              estimatedHours: z.string().optional(),
              description: z.string().optional(),
              assigneeNote: z
                .string()
                .optional()
                .describe('Nota de responsable; se anexa al description (no hay alta de persona)'),
            }),
          )
          .min(1)
          .max(500),
        dependencies: z
          .array(
            z.object({
              fromRef: z.string().min(1),
              toRef: z.string().min(1),
              type: z.string().describe('e2s | s2s | e2e | s2e'),
            }),
          )
          .optional(),
      },
    },
    async ({ project, tasks, dependencies }) => {
      try {
        const dto: ImportProjectDto = {
          project: {
            name: project.name,
            description: project.description,
            startDate: project.startDate,
            endDate: project.endDate,
            // z.string validado por el server; narrow al tipo del DTO (no `as any`).
            status: (project.status ?? 'planning') as ProjectStatus,
            color: project.color ?? DEFAULT_COLOR,
          },
          tasks: tasks.map((t) => {
            const note = t.assigneeNote ? `Responsable: ${t.assigneeNote}` : '';
            const description = [t.description, note].filter(Boolean).join('\n') || undefined;
            return {
              ref: t.ref,
              name: t.name,
              type: t.type,
              startDate: t.startDate,
              endDate: t.endDate,
              priority: t.priority ?? 'medium',
              status: t.status ?? 'not-started',
              color: t.color ?? DEFAULT_COLOR,
              parentRef: t.parentRef,
              tags: t.tags,
              estimatedHours: t.estimatedHours,
              description,
            };
          }),
          dependencies: dependencies?.map((d) => ({
            fromRef: d.fromRef,
            toRef: d.toRef,
            type: d.type as ImportLinkType,
          })),
        };
        const res = await client.importProject(dto);
        return textResult(
          `Proyecto creado: [${res.project.id}] ${res.project.name} con ${res.taskCount} tarea(s) y ${res.dependencyCount} dependencia(s).`,
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
