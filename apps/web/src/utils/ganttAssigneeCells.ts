import type { GanttApi } from 'wx-react-gantt';

export interface AssigneeCellInfo {
  displayName: string;
  avatar?: string;
  discipline?: string;
}

const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase() || '?';

const AVATAR_STYLE =
  'display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:999px;font:600 10px/1 var(--font-sans);overflow:hidden;vertical-align:middle';

// El grid de wx-react-gantt renderiza el `template` como texto (escapa HTML), así que el
// avatar se inyecta aquí por DOM. Se construye con createElement/textContent (sin innerHTML)
// para ser seguro ante XSS: nombre/disciplina/URL van como propiedades, no se parsean como HTML.
const buildBadge = (a: AssigneeCellInfo | undefined, key: string): HTMLElement => {
  const span = document.createElement('span');
  span.setAttribute('data-pwg-assignee', key);
  if (!a) {
    span.style.color = 'var(--ink-3)';
    span.textContent = '—';
    return span;
  }
  span.style.cssText = AVATAR_STYLE;
  span.title = a.discipline ? `${a.displayName} — ${a.discipline}` : a.displayName;
  if (a.avatar) {
    const img = document.createElement('img');
    img.src = a.avatar;
    img.alt = '';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover';
    span.appendChild(img);
  } else {
    span.style.background = 'var(--p-100)';
    span.style.color = 'var(--p-700)';
    span.textContent = initialsOf(a.displayName);
  }
  return span;
};

export function applyAssigneeCells(
  api: GanttApi | null,
  container: HTMLElement | null,
  assigneesById: Map<string, AssigneeCellInfo>,
): void {
  if (!api || !container) return;
  const cells = container.querySelectorAll<HTMLElement>('.wx-cell[data-col-id="assignee"]');
  cells.forEach((cell) => {
    const rowId = cell.getAttribute('data-row-id');
    if (!rowId) return;
    const task = api.getTask(rowId) as { assigneeId?: string | null } | undefined;
    const assigneeId = task?.assigneeId ? String(task.assigneeId) : null;
    const a = assigneeId ? assigneesById.get(assigneeId) : undefined;
    const key = a ? assigneeId! : 'none';
    // Guard idempotente: si ya está renderizado para esta misma asignación, no reescribir
    // (evita un bucle con el MutationObserver y trabajo redundante en cada scroll).
    const existing = cell.querySelector('[data-pwg-assignee]');
    if (existing?.getAttribute('data-pwg-assignee') === key) return;
    cell.replaceChildren(buildBadge(a, key));
  });
}
