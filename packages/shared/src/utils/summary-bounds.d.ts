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
export declare function computeSummaryBounds(nodes: SummaryBoundsNode[]): Map<string, SummaryBounds>;
