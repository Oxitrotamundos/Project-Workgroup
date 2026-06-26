import { describe, expect, it } from 'vitest';
import { computeStructuralKey } from '../ganttStructuralKey';
import type { Task, TaskLink } from '../../types/domain';

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  projectId: 'p1',
  name: `Task ${id}`,
  description: '',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-01-02T00:00:00.000Z',
  duration: 1,
  progress: 0,
  assigneeId: undefined,
  parentId: undefined,
  dependencies: [],
  tags: [],
  priority: 'medium',
  color: '#3B82F6',
  estimatedHours: 8,
  actualHours: undefined,
  status: 'not-started',
  type: 'task',
  order: 1,
  open: true,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const link = (id: string, overrides: Partial<TaskLink> = {}): TaskLink => ({
  id,
  projectId: 'p1',
  sourceTaskId: '1',
  targetTaskId: '2',
  type: 'e2s',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('computeStructuralKey', () => {
  it('es estable ante cambios de CAMPOS (fechas, progreso, nombre) con los mismos IDs', () => {
    const before = computeStructuralKey([task('1'), task('2')], []);
    const after = computeStructuralKey(
      [
        task('1', { startDate: '2026-03-15T00:00:00.000Z', endDate: '2026-03-20T00:00:00.000Z' }),
        task('2', { progress: 80, name: 'Renombrada', version: 5 }),
      ],
      [],
    );
    // Mismos IDs → misma clave → NO se regenera la prop de <Gantt> → sin rubber banding.
    expect(after).toBe(before);
  });

  it('cambia ante un alta (ID nuevo)', () => {
    const before = computeStructuralKey([task('1'), task('2')], []);
    const after = computeStructuralKey([task('1'), task('2'), task('3')], []);
    expect(after).not.toBe(before);
  });

  it('cambia ante una baja (ID removido)', () => {
    const before = computeStructuralKey([task('1'), task('2')], []);
    const after = computeStructuralKey([task('1')], []);
    expect(after).not.toBe(before);
  });

  it('es estable ante reordenamiento del array (ordena los IDs)', () => {
    const a = computeStructuralKey([task('1'), task('2'), task('3')], []);
    const b = computeStructuralKey([task('3'), task('1'), task('2')], []);
    expect(b).toBe(a);
  });

  it('considera el conjunto de links: cambia en alta/baja pero es estable ante cambio de campo', () => {
    const base = computeStructuralKey([task('1'), task('2')], [link('10')]);
    // Cambio de campo del link (type) con el mismo ID → misma clave.
    const sameSet = computeStructuralKey([task('1'), task('2')], [link('10', { type: 's2s' })]);
    expect(sameSet).toBe(base);
    // Alta de link → clave distinta.
    const added = computeStructuralKey([task('1'), task('2')], [link('10'), link('11')]);
    expect(added).not.toBe(base);
  });

  it('cambia ante un re-parent (mismo conjunto de IDs, distinto parentId)', () => {
    const before = computeStructuralKey([task('1'), task('2', { parentId: '1' })], []);
    // La tarea 2 pasa de hija de 1 a la raíz: misma lista de IDs, jerarquía distinta → reconstruir árbol.
    const after = computeStructuralKey([task('1'), task('2', { parentId: undefined })], []);
    expect(after).not.toBe(before);
  });
});
