import type { GanttApi, GanttTask } from 'wx-react-gantt';

const buildTooltip = (task: GanttTask): string | null => {
  if (task.type === 'milestone') return null;
  const lines: string[] = [String(task.text ?? '').trim() || 'Tarea'];

  const hours = Number(task.estimatedHours ?? 0);
  if (Number.isFinite(hours) && hours > 0) {
    lines.push(`• ${Number.isInteger(hours) ? hours : hours.toFixed(1)}h estimadas`);
  }

  const labDays = Number(task.duration ?? 0);
  if (Number.isFinite(labDays) && labDays > 0) {
    const labText = Number.isInteger(labDays) ? `${labDays}` : labDays.toFixed(1);
    lines.push(`• ${labText} días laborales`);
  }

  if (task.start instanceof Date && task.end instanceof Date) {
    const natDays = Math.max(1, Math.ceil((task.end.getTime() - task.start.getTime()) / 86_400_000));
    lines.push(`• ${natDays} días calendario`);
  }

  return lines.length > 1 ? lines.join('\n') : null;
};

export function applyBarTooltips(api: GanttApi | null, container: HTMLElement | null): void {
  if (!api || !container) return;
  const bars = container.querySelectorAll<HTMLElement>('.wx-bar[data-id]');
  bars.forEach((bar) => {
    const id = bar.getAttribute('data-id');
    if (!id) return;
    const task = api.getTask(id);
    if (!task) return;
    const text = buildTooltip(task);
    if (text) bar.setAttribute('title', text);
    else bar.removeAttribute('title');
  });
}
