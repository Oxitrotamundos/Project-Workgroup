import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskSidebar from '../../components/TaskSidebar/TaskSidebar';
import { ProjectSettingsProvider } from '../../contexts/ProjectSettingsContext';
import type { Task } from '../../types/domain';

const baseTask: Task = {
  id: '42',
  projectId: 'p1',
  name: 'Tarea de prueba',
  description: 'Descripción inicial',
  startDate: '2026-05-19T00:00:00.000Z',
  endDate: '2026-05-21T00:00:00.000Z',
  duration: 2,
  progress: 30,
  dependencies: [],
  tags: [],
  priority: 'medium',
  color: '#3B82F6',
  estimatedHours: 16,
  status: 'in-progress',
  type: 'task',
  order: 1,
  version: 5,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-19T00:00:00.000Z',
};

const wrapHours = (children: React.ReactNode) => (
  <ProjectSettingsProvider
    settings={{
      projectId: 'p1',
      timeGranularity: 'hours',
      createdAt: '',
      updatedAt: '',
    }}
  >
    {children}
  </ProjectSettingsProvider>
);

const wrapDays = (children: React.ReactNode) => (
  <ProjectSettingsProvider
    settings={{
      projectId: 'p1',
      timeGranularity: 'days',
      createdAt: '',
      updatedAt: '',
    }}
  >
    {children}
  </ProjectSettingsProvider>
);

describe('TaskSidebar', () => {
  it('renders task fields and saves changed name with expectedVersion', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(wrapHours(<TaskSidebar task={baseTask} open onClose={onClose} onSave={onSave} />));

    const nameInput = screen.getByDisplayValue('Tarea de prueba') as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, 'Nombre nuevo');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('42', expect.objectContaining({ name: 'Nombre nuevo' }), 5);
  });

  it('hides the hours field when granularity is days', () => {
    render(
      wrapDays(<TaskSidebar task={baseTask} open onClose={vi.fn()} onSave={vi.fn()} />),
    );
    expect(screen.queryByText('Horas estimadas')).not.toBeInTheDocument();
  });

  it('closes without saving when there are no diffs', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(wrapHours(<TaskSidebar task={baseTask} open onClose={onClose} onSave={onSave} />));
    await user.click(screen.getByRole('button', { name: /guardar/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
