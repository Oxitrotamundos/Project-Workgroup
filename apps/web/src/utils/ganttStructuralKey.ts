import type { Task, TaskLink } from '../types/domain';

/**
 * Clave estructural barata para decidir cuándo regenerar la prop `tasks`/`links` de
 * `<Gantt>` (que dispara `A.init` → reset completo del store de wx-react-gantt) y cuándo
 * basta con sincronizar el store de forma imperativa (`exec _silent`, sin reset).
 *
 * La clave depende del conjunto de IDs de tareas/links y de la JERARQUÍA (parentId de cada tarea),
 * por lo que:
 * - cambia ante altas/bajas (hay que reconstruir el árbol del Gantt),
 * - cambia ante un re-parent (mover una tarea a otro padre): la jerarquía sí es estructura y el
 *   árbol debe reconstruirse,
 * - NO cambia ante cambios de campos no estructurales (fechas, progreso, nombre, orden) — esos se
 *   reflejan imperativamente, manteniendo la referencia estable y evitando el "rubber banding".
 *
 * El orden de los arrays no afecta el resultado (se ordena), de modo que un simple
 * reordenamiento del array entrante no cuenta como cambio estructural.
 */
export const computeStructuralKey = (tasks: Task[], links: TaskLink[]): string => {
  const taskIds = tasks
    .map((t) => `${t.id}:${t.parentId ?? ''}`)
    .sort()
    .join(',');
  const linkIds = links
    .map((l) => l.id)
    .sort()
    .join(',');
  return `${taskIds}|${linkIds}`;
};
