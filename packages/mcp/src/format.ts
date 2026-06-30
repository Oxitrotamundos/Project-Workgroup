import type {
  ProjectResponse,
  TaskResponse,
  UserResponse,
} from '@project-workgroup/shared';

export function formatProjectLine(p: ProjectResponse): string {
  return `- [${p.id}] ${p.name} · ${p.status} · ${p.startDate}→${p.endDate}`;
}

export function formatUserLine(u: UserResponse): string {
  return `- [${u.id}] ${u.displayName} <${u.email}> · ${u.role}`;
}

export function formatTaskLine(t: TaskResponse): string {
  const assignee = t.assigneeId ? ` · @${t.assigneeId}` : '';
  return `- [${t.id}] ${t.name} · ${t.type} · ${t.status} · ${t.progress}%${assignee}`;
}

export function formatTaskDetail(t: TaskResponse): string {
  const assignee = t.assigneeId ? `asignado a ${t.assigneeId}` : 'sin asignar';
  const tags = t.tags.length ? ` · tags: ${t.tags.join(', ')}` : '';
  return [
    `Tarea [${t.id}] ${t.name}`,
    `  tipo: ${t.type} · estado: ${t.status} · prioridad: ${t.priority}`,
    `  fechas: ${t.startDate}→${t.endDate} · progreso: ${t.progress}%`,
    `  ${assignee}${tags}`,
  ].join('\n');
}
