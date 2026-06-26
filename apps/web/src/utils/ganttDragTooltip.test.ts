import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  detectDragMode,
  hasDragSignal,
  computePreviewDates,
  formatDragLabel,
  computeAnchor,
  GanttDragTooltip,
} from './ganttDragTooltip';

describe('detectDragMode', () => {
  it('detecta un movimiento cuando el ancho se mantiene', () => {
    expect(detectDragMode(50, 0)).toBe('move');
  });

  it('detecta resize del borde derecho cuando el izquierdo queda fijo', () => {
    expect(detectDragMode(0, 40)).toBe('resize-end');
  });

  it('detecta resize del borde izquierdo cuando el derecho queda fijo', () => {
    expect(detectDragMode(-20, 20)).toBe('resize-start');
  });

  it('clasifica por el borde que menos se mueve, tolerando ruido en el otro', () => {
    // izquierdo se mueve 2px, derecho 5px => el izquierdo es el fijo => resize del fin
    expect(detectDragMode(2, 3)).toBe('resize-end');
    // derecho se mueve 1px, izquierdo 6px => el derecho es el fijo => resize del inicio
    expect(detectDragMode(6, -5)).toBe('resize-start');
  });
});

describe('hasDragSignal', () => {
  it('es falso cuando ambos ejes están por debajo del umbral', () => {
    expect(hasDragSignal(2, 2)).toBe(false);
    expect(hasDragSignal(0, 0)).toBe(false);
  });

  it('es verdadero cuando algún eje supera el umbral', () => {
    expect(hasDragSignal(3, 0)).toBe(true);
    expect(hasDragSignal(0, 5)).toBe(true);
  });
});

describe('computePreviewDates', () => {
  const start0 = new Date(2026, 5, 23, 9, 0, 0); // 23 jun 2026, 09:00 local
  const end0 = new Date(2026, 5, 23, 17, 0, 0); // 23 jun 2026, 17:00 local

  it('mueve ambos extremos en horas cuando lengthUnit es hour', () => {
    // pxPerDay=240 => pxPerHora=10; dLeft=30 => +3h
    const { start, end } = computePreviewDates({
      start0, end0, dLeft: 30, dWidth: 0, pxPerDay: 240, lengthUnit: 'hour', mode: 'move',
    });
    expect(start?.getHours()).toBe(12);
    expect(end?.getHours()).toBe(20);
  });

  it('mueve ambos extremos en días preservando la hora cuando lengthUnit es day', () => {
    // pxPerDay=20 => pxPorDia=20; dLeft=40 => +2 días
    const { start, end } = computePreviewDates({
      start0, end0, dLeft: 40, dWidth: 0, pxPerDay: 20, lengthUnit: 'day', mode: 'move',
    });
    expect(start?.getDate()).toBe(25);
    expect(start?.getHours()).toBe(9); // la hora se preserva en snap diario
    expect(end?.getDate()).toBe(25);
  });

  it('en resize-end solo ajusta el fin y deja el inicio sin definir', () => {
    // pxPerDay=240 => pxPorHora=10; dWidth=20 => +2h
    const { start, end } = computePreviewDates({
      start0, end0, dLeft: 0, dWidth: 20, pxPerDay: 240, lengthUnit: 'hour', mode: 'resize-end',
    });
    expect(start).toBeUndefined();
    expect(end?.getHours()).toBe(19);
  });

  it('en resize-start solo ajusta el inicio y deja el fin sin definir', () => {
    // pxPerDay=20 => pxPorDia=20; dLeft=-20 => -1 día
    const { start, end } = computePreviewDates({
      start0, end0, dLeft: -20, dWidth: 20, pxPerDay: 20, lengthUnit: 'day', mode: 'resize-start',
    });
    expect(end).toBeUndefined();
    expect(start?.getDate()).toBe(22);
  });

  it('redondea el delta de píxeles a la unidad más cercana (igual que el snap nativo)', () => {
    // pxPorHora=10; dLeft=26 => 2.6 => 3h
    const up = computePreviewDates({
      start0, end0, dLeft: 26, dWidth: 0, pxPerDay: 240, lengthUnit: 'hour', mode: 'move',
    });
    expect(up.start?.getHours()).toBe(12); // 9 + 3
    // dLeft=24 => 2.4 => 2h
    const down = computePreviewDates({
      start0, end0, dLeft: 24, dWidth: 0, pxPerDay: 240, lengthUnit: 'hour', mode: 'move',
    });
    expect(down.start?.getHours()).toBe(11); // 9 + 2
  });
});

describe('formatDragLabel', () => {
  const start = new Date(2026, 5, 23, 9, 0, 0);
  const end = new Date(2026, 5, 27, 17, 0, 0);

  it('en move muestra inicio y fin con una flecha', () => {
    const label = formatDragLabel({ start, end }, 'day', 'move');
    expect(label).toContain('→');
    expect(label).toContain('23');
    expect(label).toContain('27');
  });

  it('en modo día no incluye la hora', () => {
    const label = formatDragLabel({ start, end }, 'day', 'move');
    expect(label).not.toContain(':');
  });

  it('en modo hora incluye la hora', () => {
    const label = formatDragLabel({ end }, 'hour', 'resize-end');
    expect(label).toContain(':');
    expect(label).not.toContain('→');
  });

  it('en resize muestra solo el borde manipulado', () => {
    const startOnly = formatDragLabel({ start }, 'day', 'resize-start');
    expect(startOnly).toContain('23');
    expect(startOnly).not.toContain('→');
  });
});

describe('computeAnchor', () => {
  // Barra en (left=100, right=180, width=80, top=50); contenedor en (left=10, top=20).
  const bar = { left: 100, right: 180, top: 50, width: 80 };
  const cont = { left: 10, right: 500, top: 20, width: 490 };

  it('al mover ancla en el centro de la barra, relativo al contenedor', () => {
    expect(computeAnchor(bar, cont, 'move')).toEqual({ x: 130, y: 30 }); // (100+40)-10 ; 50-20
  });

  it('al redimensionar el fin ancla en el borde derecho', () => {
    expect(computeAnchor(bar, cont, 'resize-end')).toEqual({ x: 170, y: 30 }); // 180-10
  });

  it('al redimensionar el inicio ancla en el borde izquierdo', () => {
    expect(computeAnchor(bar, cont, 'resize-start')).toEqual({ x: 90, y: 30 }); // 100-10
  });
});

describe('GanttDragTooltip (controlador DOM)', () => {
  const start0 = new Date(2026, 5, 23, 9, 0, 0);
  const end0 = new Date(2026, 5, 23, 17, 0, 0);
  // El tipo de la API se deriva del método para no importar 'wx-react-gantt' en el test.
  type DragApi = Parameters<GanttDragTooltip['onDrag']>[1];
  const api = { getTask: () => ({ start: start0, end: end0 }) } as unknown as DragApi;
  const ctx = { pxPerDay: 240, lengthUnit: 'hour' as const };
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    // El controlador busca la barra por data-id para tomar su posición.
    const bar = document.createElement('div');
    bar.className = 'wx-bar';
    bar.setAttribute('data-id', '1');
    container.appendChild(bar);
    document.body.appendChild(container);
  });
  afterEach(() => {
    container.remove();
  });

  const el = () => container.querySelector<HTMLElement>('.gantt-drag-tooltip');
  const drag = (tip: GanttDragTooltip, left: number, width: number) =>
    tip.onDrag({ id: '1', left, width, inProgress: true }, api, ctx);

  it('solo muestra el tooltip tras un desplazamiento real', () => {
    const tip = new GanttDragTooltip(container);
    drag(tip, 100, 80); // baseline, sin movimiento => aún no se muestra
    expect(el()).toBeNull();
    drag(tip, 130, 80); // movimiento => se muestra
    expect(el()!.style.display).toBe('block');
    expect(el()!.textContent).toContain('→'); // move
  });

  it('no muestra nada si la barra no está en el DOM', () => {
    container.querySelector('.wx-bar')!.remove();
    const tip = new GanttDragTooltip(container);
    drag(tip, 100, 80);
    drag(tip, 130, 80);
    expect(el()).toBeNull();
  });

  it('fija el modo del gesto y no oscila entre mover y redimensionar', () => {
    const tip = new GanttDragTooltip(container);
    drag(tip, 100, 80); // baseline
    drag(tip, 100, 120); // resize del fin (ancho +40) => se fija resize
    expect(el()!.textContent).not.toContain('→');
    // microajuste posterior que aislado parecería "move"; el latch debe mantener el resize
    drag(tip, 101, 81);
    expect(el()!.textContent).not.toContain('→');
  });

  it('oculta el tooltip al soltar (drag-task inProgress:false)', () => {
    const tip = new GanttDragTooltip(container);
    drag(tip, 100, 80);
    drag(tip, 130, 80);
    tip.onDrag({ id: '1', inProgress: false }, api, ctx);
    expect(el()!.style.display).toBe('none');
  });

  it('oculta el tooltip al soltar el puntero, aunque wx no emita un drag-task final', () => {
    const tip = new GanttDragTooltip(container);
    drag(tip, 100, 80);
    drag(tip, 130, 80);
    expect(el()!.style.display).toBe('block');
    window.dispatchEvent(new Event('pointerup')); // al soltar con cambios wx emite update-task
    expect(el()!.style.display).toBe('none');
  });

  it('reinicia el baseline al soltar para clasificar bien el siguiente gesto', () => {
    const dayApi = {
      getTask: () => ({ start: new Date(2026, 5, 23), end: new Date(2026, 5, 27) }),
    } as unknown as DragApi;
    const dayCtx = { pxPerDay: 20, lengthUnit: 'day' as const };
    const tip = new GanttDragTooltip(container);
    // Gesto 1 sobre la tarea 1: resize del inicio (borde izquierdo).
    tip.onDrag({ id: '1', left: 100, width: 80, inProgress: true }, dayApi, dayCtx);
    tip.onDrag({ id: '1', left: 80, width: 100, inProgress: true }, dayApi, dayCtx);
    window.dispatchEvent(new Event('pointerup'));
    // Gesto 2 sobre la MISMA tarea: alargar el fin (+2 días) => debe mostrar el FIN (29 jun),
    // no el inicio. Con el baseline obsoleto se clasificaría como resize del inicio (22 jun).
    tip.onDrag({ id: '1', left: 80, width: 100, inProgress: true }, dayApi, dayCtx);
    tip.onDrag({ id: '1', left: 80, width: 140, inProgress: true }, dayApi, dayCtx);
    expect(el()!.textContent).toContain('29');
  });

  it('destroy elimina el elemento del DOM', () => {
    const tip = new GanttDragTooltip(container);
    drag(tip, 100, 80);
    drag(tip, 130, 80);
    tip.destroy();
    expect(el()).toBeNull();
  });
});
