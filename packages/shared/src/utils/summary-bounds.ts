export interface SummaryBoundsNode {
  id: string;
  parentId?: string | null;
  type: string;
  /** Epoch ms, o null si la fecha falta o es inválida. */
  start: number | null;
  end: number | null;
}

export interface SummaryBounds {
  start: number;
  end: number;
}

/**
 * Rango (mín start / máx end, en epoch ms) de cada summary, agregando las fechas de TODOS sus
 * descendientes no-summary. Una task con subtareas aporta su propia fecha (su barra es real); los
 * summaries derivan de sus hijos. Devuelve solo los summaries con al menos una fecha agregable.
 *
 * Fuente única de la regla, compartida por el Gantt (web) y el recálculo de summaries (api).
 */
export function computeSummaryBounds(
  nodes: SummaryBoundsNode[],
): Map<string, SummaryBounds> {
  const childrenByParent = new Map<string, SummaryBoundsNode[]>();
  for (const node of nodes) {
    if (node.parentId === undefined || node.parentId === null) continue;
    const siblings = childrenByParent.get(node.parentId);
    if (siblings) siblings.push(node);
    else childrenByParent.set(node.parentId, [node]);
  }

  // Bounds de los DESCENDIENTES de `id` (sin incluir `id`), memoizado.
  const memo = new Map<string, SummaryBounds | null>();
  const inProgress = new Set<string>();
  const descendantBounds = (id: string): SummaryBounds | null => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    // Guard de ciclos: un parentId corrupto no debe colgar el recorrido.
    if (inProgress.has(id)) return null;
    inProgress.add(id);

    let start: number | null = null;
    let end: number | null = null;
    const include = (s: number | null, e: number | null) => {
      if (s !== null) start = start === null ? s : Math.min(start, s);
      if (e !== null) end = end === null ? e : Math.max(end, e);
    };

    for (const child of childrenByParent.get(id) ?? []) {
      if (child.type !== 'summary') include(child.start, child.end);
      const sub = descendantBounds(child.id);
      if (sub) include(sub.start, sub.end);
    }

    inProgress.delete(id);
    const result = start !== null && end !== null ? { start, end } : null;
    memo.set(id, result);
    return result;
  };

  const bounds = new Map<string, SummaryBounds>();
  for (const node of nodes) {
    if (node.type !== 'summary') continue;
    const result = descendantBounds(node.id);
    if (result) bounds.set(node.id, result);
  }
  return bounds;
}
