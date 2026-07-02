import type {
  ProjectResponse,
  TaskResponse,
  UserResponse,
} from '@project-workgroup/shared';

// recorta a n caracteres añadiendo ellipsis si excede
function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function formatProjectLine(p: ProjectResponse): string {
  const desc = p.description && p.description.trim()
    ? ` — ${truncate(p.description.trim(), 80)}`
    : '';
  return `- [${p.id}] ${p.name} · ${p.status} · ${p.startDate}→${p.endDate}${desc}`;
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
    `  fechas: ${t.startDate.slice(0, 10)}→${t.endDate.slice(0, 10)} · progreso: ${t.progress}%`,
    `  ${assignee}${tags}`,
  ].join('\n');
}
