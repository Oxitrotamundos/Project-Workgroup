import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalendarChip from '../../components/Layout/CalendarChip';
import type { WorkingCalendarResponse } from '@project-workgroup/shared';

const makeCalendar = (overrides: Partial<WorkingCalendarResponse> = {}): WorkingCalendarResponse => ({
  id: '1',
  scope: 'project',
  projectId: 'p1',
  name: 'Test',
  timezone: 'America/Mexico_City',
  patterns: [
    { weekday: 0, enabled: false, dayStart: null, breakStart: null, breakEnd: null, dayEnd: null },
    { weekday: 1, enabled: true, dayStart: '09:00', breakStart: null, breakEnd: null, dayEnd: '18:00' },
    { weekday: 2, enabled: true, dayStart: '09:00', breakStart: null, breakEnd: null, dayEnd: '18:00' },
    { weekday: 3, enabled: true, dayStart: '09:00', breakStart: null, breakEnd: null, dayEnd: '18:00' },
    { weekday: 4, enabled: true, dayStart: '09:00', breakStart: null, breakEnd: null, dayEnd: '18:00' },
    { weekday: 5, enabled: true, dayStart: '09:00', breakStart: null, breakEnd: null, dayEnd: '18:00' },
    { weekday: 6, enabled: false, dayStart: null, breakStart: null, breakEnd: null, dayEnd: null },
  ],
  holidays: [],
  hoursPerDay: '8',
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

describe('CalendarChip', () => {
  it('renders L–V · 9–18 for a standard Mon–Fri 9 to 18 calendar', () => {
    render(<CalendarChip calendar={makeCalendar()} onClick={vi.fn()} />);
    expect(screen.getByText('L–V · 9–18')).toBeInTheDocument();
  });

  it('renders only the weekday range when hours vary between days', () => {
    const cal = makeCalendar({
      patterns: [
        { weekday: 0, enabled: false, dayStart: null, breakStart: null, breakEnd: null, dayEnd: null },
        { weekday: 1, enabled: true, dayStart: '09:00', breakStart: null, breakEnd: null, dayEnd: '18:00' },
        { weekday: 2, enabled: true, dayStart: '08:00', breakStart: null, breakEnd: null, dayEnd: '17:00' },
        { weekday: 3, enabled: true, dayStart: '09:00', breakStart: null, breakEnd: null, dayEnd: '18:00' },
        { weekday: 4, enabled: true, dayStart: '09:00', breakStart: null, breakEnd: null, dayEnd: '18:00' },
        { weekday: 5, enabled: true, dayStart: '09:00', breakStart: null, breakEnd: null, dayEnd: '18:00' },
        { weekday: 6, enabled: false, dayStart: null, breakStart: null, breakEnd: null, dayEnd: null },
      ],
    });
    render(<CalendarChip calendar={cal} onClick={vi.fn()} />);
    expect(screen.getByText('L–V')).toBeInTheDocument();
  });

  it('renders a fallback "Calendario" label when calendar is null', () => {
    render(<CalendarChip calendar={null} onClick={vi.fn()} />);
    expect(screen.getByText('Calendario')).toBeInTheDocument();
  });

  it('invokes onClick when the chip is activated', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<CalendarChip calendar={makeCalendar()} onClick={onClick} />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
