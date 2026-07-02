// Constantes puras de tarea (sin decoradores) para que consumidores ligeros
// como el paquete mcp puedan importarlas sin arrastrar class-validator ni reflect-metadata.
export const TASK_STATUSES = ['not-started', 'in-progress', 'completed', 'blocked'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_TYPES = ['task', 'summary', 'milestone'] as const;
export type TaskType = (typeof TASK_TYPES)[number];
