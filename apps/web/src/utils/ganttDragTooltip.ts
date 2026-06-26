import type { GanttApi, GanttId } from 'wx-react-gantt';

export type DragMode = 'move' | 'resize-start' | 'resize-end';
export type LengthUnit = 'hour' | 'day';

// Por debajo de este umbral (px) el desplazamiento en un eje se considera ruido, no intención.
const TOL_PX = 1;

/**
 * Clasifica el gesto comparando el desplazamiento de la barra:
 * - ancho ~constante  → movimiento (la barra se traslada)
 * - left ~constante   → resize del borde derecho (solo crece/encoge el ancho)
 * - left y ancho cambian → resize del borde izquierdo
 */
export function detectDragMode(dLeft: number, dWidth: number): DragMode {
  if (Math.abs(dWidth) <= TOL_PX) return 'move';
  // Ancho cambió: es un resize. El borde que menos se movió es el fijo; el otro es el manipulado.
  // Comparar magnitudes (en vez de exigir dLeft≈0) tolera el ruido sub-pixel que reporta wx.
  const dRight = dLeft + dWidth;
  return Math.abs(dLeft) <= Math.abs(dRight) ? 'resize-end' : 'resize-start';
}

// Desplazamiento mínimo (px) para considerar el gesto "declarado" y fijar su modo.
const SIGNAL_PX = 3;

/** ¿Hubo desplazamiento suficiente para clasificar el gesto? Evita decidir el modo con ruido. */
export function hasDragSignal(dLeft: number, dWidth: number): boolean {
  return Math.abs(dLeft) >= SIGNAL_PX || Math.abs(dWidth) >= SIGNAL_PX;
}

export interface PreviewInput {
  start0: Date;
  end0: Date;
  dLeft: number;
  dWidth: number;
  pxPerDay: number;
  lengthUnit: LengthUnit;
  mode: DragMode;
}

export interface PreviewDates {
  start?: Date;
  end?: Date;
}

// Suma n unidades replicando el snap nativo de wx: horas en ms; días con setDate (preserva la hora).
function addUnits(date: Date, n: number, unit: LengthUnit): Date {
  const d = new Date(date.getTime());
  if (unit === 'hour') d.setTime(d.getTime() + n * 3_600_000);
  else d.setDate(d.getDate() + n);
  return d;
}

/**
 * Deriva las fechas destino (ya redondeadas a la unidad) a partir del desplazamiento en píxeles,
 * replicando el cálculo del snap nativo: diff = round(deltaPx / anchoUnidad). Así el tooltip
 * muestra exactamente dónde asentará la barra al soltar.
 */
export function computePreviewDates(input: PreviewInput): PreviewDates {
  const { start0, end0, dLeft, dWidth, pxPerDay, lengthUnit, mode } = input;
  const pxPerUnit = lengthUnit === 'hour' ? pxPerDay / 24 : pxPerDay;
  if (!(pxPerUnit > 0)) return {};

  if (mode === 'resize-end') {
    return { end: addUnits(end0, Math.round(dWidth / pxPerUnit), lengthUnit) };
  }
  if (mode === 'resize-start') {
    return { start: addUnits(start0, Math.round(dLeft / pxPerUnit), lengthUnit) };
  }
  const diff = Math.round(dLeft / pxPerUnit);
  return {
    start: addUnits(start0, diff, lengthUnit),
    end: addUnits(end0, diff, lengthUnit),
  };
}

const dayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const hourFmt = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatOne(date: Date, lengthUnit: LengthUnit): string {
  return (lengthUnit === 'hour' ? hourFmt : dayFmt).format(date);
}

/** Texto del tooltip: "inicio → fin" al mover; la fecha del borde manipulado al redimensionar. */
export function formatDragLabel(dates: PreviewDates, lengthUnit: LengthUnit, mode: DragMode): string {
  if (mode === 'move' && dates.start && dates.end) {
    return `${formatOne(dates.start, lengthUnit)} → ${formatOne(dates.end, lengthUnit)}`;
  }
  if (mode === 'resize-start' && dates.start) return formatOne(dates.start, lengthUnit);
  if (mode === 'resize-end' && dates.end) return formatOne(dates.end, lengthUnit);
  const single = dates.start ?? dates.end;
  return single ? formatOne(single, lengthUnit) : '';
}

export interface DragTooltipContext {
  pxPerDay: number;
  lengthUnit: LengthUnit;
}

/** Rectángulo mínimo (subconjunto de DOMRect) necesario para posicionar el tooltip. */
export interface Rect {
  left: number;
  right: number;
  top: number;
  width: number;
}

/**
 * Posición del tooltip relativa al contenedor: x según el gesto (centro al mover, borde manipulado
 * al redimensionar) e y en el borde superior de la barra. Se calcula desde el rect real de la barra
 * porque el payload de `drag-task` no trae `top`; esto además absorbe el scroll del chart.
 */
export function computeAnchor(bar: Rect, container: Rect, mode: DragMode): { x: number; y: number } {
  const x = mode === 'move' ? bar.left + bar.width / 2 : mode === 'resize-end' ? bar.right : bar.left;
  return { x: x - container.left, y: bar.top - container.top };
}

interface DragTaskPayload {
  id: GanttId;
  left?: number;
  width?: number;
  top?: number;
  inProgress?: boolean;
}

interface DragBaseline {
  id: GanttId;
  left0: number;
  width0: number;
  start0: Date;
  end0: Date;
  mode?: DragMode; // se fija una vez por gesto (latch) para no oscilar entre mover/redimensionar
}

/**
 * Tooltip flotante que sigue el arrastre/redimensión de una barra y muestra dónde quedará la tarea.
 * Las fechas se derivan de la geometría que emite wx en `drag-task` (no toca el store ni persiste).
 */
export class GanttDragTooltip {
  private el: HTMLElement | null = null;
  private baseline: DragBaseline | null = null;
  // Señal de fin del gesto: al soltar con cambios wx emite `update-task` (no un drag-task con
  // inProgress:false), así que el pointerup/mouseup del navegador es lo fiable. Además resetea el
  // baseline (vía hide) para que el siguiente gesto sobre la misma tarea se clasifique de cero.
  private readonly endGesture = (): void => this.hide();

  constructor(private readonly container: HTMLElement) {
    window.addEventListener('pointerup', this.endGesture);
    window.addEventListener('mouseup', this.endGesture);
  }

  private ensureEl(): HTMLElement {
    if (this.el && this.el.isConnected) return this.el;
    const el = document.createElement('div');
    el.className = 'gantt-drag-tooltip';
    el.style.display = 'none';
    this.container.appendChild(el);
    this.el = el;
    return el;
  }

  /** Maneja un evento `drag-task`. Llamar con la API y el contexto de zoom/scroll vigentes. */
  onDrag(payload: DragTaskPayload, api: GanttApi, ctx: DragTooltipContext): void {
    const { id, left, width, inProgress } = payload;
    if (!inProgress) {
      this.hide();
      return;
    }
    if (left === undefined || width === undefined) return;

    // Primer frame del gesto: fija la geometría y las fechas de partida.
    if (!this.baseline || this.baseline.id !== id) {
      const task = api.getTask?.(id);
      if (!task || !(task.start instanceof Date) || !(task.end instanceof Date)) return;
      this.baseline = { id, left0: left, width0: width, start0: task.start, end0: task.end };
    }

    const base = this.baseline;
    const dLeft = left - base.left0;
    const dWidth = width - base.width0;
    // Fija el modo en cuanto hay desplazamiento real y lo conserva hasta soltar, para que el
    // tooltip no parpadee entre "mover" y "redimensionar" mientras se arrastra un borde.
    if (base.mode === undefined) {
      if (!hasDragSignal(dLeft, dWidth)) return;
      base.mode = detectDragMode(dLeft, dWidth);
    }
    const mode = base.mode;
    const dates = computePreviewDates({
      start0: base.start0,
      end0: base.end0,
      dLeft,
      dWidth,
      pxPerDay: ctx.pxPerDay,
      lengthUnit: ctx.lengthUnit,
      mode,
    });
    const label = formatDragLabel(dates, ctx.lengthUnit, mode);
    if (!label) return;

    // El payload no trae la posición vertical: usamos el rect real de la barra ya movida por wx.
    const bar = this.container.querySelector<HTMLElement>(`.wx-bar[data-id="${String(id)}"]`);
    if (!bar) return;
    const { x, y } = computeAnchor(
      bar.getBoundingClientRect(),
      this.container.getBoundingClientRect(),
      mode,
    );
    this.show(label, x, y);
  }

  private show(text: string, x: number, y: number): void {
    const el = this.ensureEl();
    el.textContent = text;
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.display = 'block';
  }

  hide(): void {
    this.baseline = null;
    if (this.el) this.el.style.display = 'none';
  }

  destroy(): void {
    window.removeEventListener('pointerup', this.endGesture);
    window.removeEventListener('mouseup', this.endGesture);
    this.baseline = null;
    if (this.el?.parentNode) this.el.parentNode.removeChild(this.el);
    this.el = null;
  }
}
