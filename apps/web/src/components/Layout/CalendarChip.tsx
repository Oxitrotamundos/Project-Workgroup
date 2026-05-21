import React from 'react';
import { Clock } from 'lucide-react';
import type {
  WorkingCalendarResponse,
  WorkingDayPatternResponse,
} from '@project-workgroup/shared';

const WEEKDAY_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const formatHour = (raw: string | null): string | null => {
  if (!raw) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(raw);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour)) return null;
  if (minute === 0) return String(hour);
  return `${hour}:${String(minute).padStart(2, '0')}`;
};

const buildWeekdayLabel = (patterns: WorkingDayPatternResponse[]): string => {
  const enabled = patterns
    .filter((p) => p.enabled)
    .map((p) => p.weekday)
    .sort((a, b) => a - b);
  if (enabled.length === 0) return '—';

  const groups: number[][] = [];
  for (const wd of enabled) {
    const last = groups[groups.length - 1];
    if (last && wd === last[last.length - 1] + 1) {
      last.push(wd);
    } else {
      groups.push([wd]);
    }
  }
  return groups
    .map((group) =>
      group.length === 1
        ? WEEKDAY_SHORT[group[0]]
        : `${WEEKDAY_SHORT[group[0]]}–${WEEKDAY_SHORT[group[group.length - 1]]}`,
    )
    .join(' ');
};

const buildTimeLabel = (patterns: WorkingDayPatternResponse[]): string | null => {
  const enabled = patterns.filter((p) => p.enabled);
  if (enabled.length === 0) return null;
  const starts = enabled.map((p) => formatHour(p.dayStart)).filter((v): v is string => !!v);
  const ends = enabled.map((p) => formatHour(p.dayEnd)).filter((v): v is string => !!v);
  if (starts.length === 0 || ends.length === 0) return null;
  const allSameStart = starts.every((s) => s === starts[0]);
  const allSameEnd = ends.every((e) => e === ends[0]);
  if (allSameStart && allSameEnd) return `${starts[0]}–${ends[0]}`;
  return null;
};

interface Props {
  calendar: WorkingCalendarResponse | null | undefined;
  onClick?: () => void;
  className?: string;
}

const CalendarChip: React.FC<Props> = ({ calendar, onClick, className = '' }) => {
  if (!calendar) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`btn btn-ghost btn-sm ${className}`.trim()}
        title="Calendario laboral del proyecto"
      >
        <Clock className="w-4 h-4" />
        <span className="hidden sm:inline">Calendario</span>
      </button>
    );
  }

  const weekdayLabel = buildWeekdayLabel(calendar.patterns);
  const timeLabel = buildTimeLabel(calendar.patterns);
  const visualLabel = timeLabel ? `${weekdayLabel} · ${timeLabel}` : weekdayLabel;
  const title = `Calendario laboral · ${calendar.timezone}${timeLabel ? '' : ' (horario variable)'} — clic para editar`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn btn-ghost btn-sm ${className}`.trim()}
      title={title}
      aria-label={`Calendario: ${visualLabel}`}
    >
      <Clock className="w-4 h-4" />
      <span className="hidden sm:inline">{visualLabel}</span>
      <span className="sm:hidden">Cal.</span>
    </button>
  );
};

export default CalendarChip;
