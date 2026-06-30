import type { ProjectResponse, TaskResponse } from '@project-workgroup/shared';

export interface ProjectOverview {
  total: number;
  byStatus: Record<string, number>;
  avgProgress: number;
  overdue: TaskResponse[];
  upcomingMilestones: TaskResponse[];
}

// Agrega el estado del proyecto. `now` se inyecta para tests deterministas.
export function buildOverview(
  _project: ProjectResponse,
  tasks: TaskResponse[],
  now: Date = new Date(),
): ProjectOverview {
  // Los summaries son agregados; el conteo y el avance se miden sobre las hojas.
  const leaves = tasks.filter((t) => t.type !== 'summary');
  const byStatus: Record<string, number> = {};
  for (const t of leaves) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;

  const avgProgress =
    leaves.length === 0
      ? 0
      : Math.round(leaves.reduce((s, t) => s + t.progress, 0) / leaves.length);

  const nowMs = now.getTime();
  const overdue = leaves
    .filter(
      (t) =>
        t.status !== 'completed' && new Date(t.endDate).getTime() < nowMs,
    )
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

  const upcomingMilestones = tasks
    .filter(
      (t) => t.type === 'milestone' && new Date(t.endDate).getTime() >= nowMs,
    )
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

  return { total: leaves.length, byStatus, avgProgress, overdue, upcomingMilestones };
}

export function formatProjectOverview(
  project: ProjectResponse,
  tasks: TaskResponse[],
  now: Date = new Date(),
): string {
  const o = buildOverview(project, tasks, now);
  const statusLines =
    Object.entries(o.byStatus)
      .map(([s, n]) => `    ${s}: ${n}`)
      .join('\n') || '    (sin tareas)';
  // Aplica un tope y, si sobra, añade un marcador "+N más".
  const capped = (rendered: string[], cap: number): string => {
    const shown = rendered.slice(0, cap);
    if (rendered.length > cap) shown.push(`    … +${rendered.length - cap} más`);
    return shown.join('\n');
  };
  const overdueLines = o.overdue.length
    ? capped(
        o.overdue.map(
          (t) => `    - [${t.id}] ${t.name} (venció ${t.endDate.slice(0, 10)})`,
        ),
        10,
      )
    : '    (ninguna)';
  const milestoneLines = o.upcomingMilestones.length
    ? capped(
        o.upcomingMilestones.map(
          (t) => `    - [${t.id}] ${t.name} (${t.endDate.slice(0, 10)})`,
        ),
        5,
      )
    : '    (ninguno)';
  return [
    `Proyecto [${project.id}] ${project.name} · ${project.status}`,
    `  rango: ${project.startDate}→${project.endDate}`,
    `  tareas: ${o.total} · avance medio: ${o.avgProgress}%`,
    `  por estado:`,
    statusLines,
    `  hitos próximos:`,
    milestoneLines,
    `  atrasadas:`,
    overdueLines,
  ].join('\n');
}
