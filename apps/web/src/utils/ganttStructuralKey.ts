import type { Task, TaskLink } from '../types/domain';

/**
 * Clave estructural barata para decidir cuándo regenerar la prop `tasks`/`links` de
 * `<Gantt>` (que dispara `A.init` → reset completo del store de wx-react-gantt) y cuándo
 * basta con sincronizar el store de forma imperativa (`exec _silent`, sin reset).
 *
 * La clave depende SOLO del CONJUNTO de IDs de tareas y links, por lo que:
 * - cambia ante altas/bajas (hay que reconstruir el árbol del Gantt),
 * - NO cambia ante cambios de campos (fechas, progreso, nombre, orden) — esos se reflejan
 *   imperativamente, manteniendo la referencia estable y evitando el "rubber banding".
 *
 * El orden de los arrays no afecta el resultado (se ordena), de modo que un simple
 * reordenamiento del array entrante no cuenta como cambio estructural.
 */
export const computeStructuralKey = (tasks: Task[], links: TaskLink[]): string => {
  const taskIds = tasks
    .map((t) => t.id)
    .sort()
    .join(',');
  const linkIds = links
    .map((l) => l.id)
    .sort()
    .join(',');
  return `${taskIds}|${linkIds}`;
};
