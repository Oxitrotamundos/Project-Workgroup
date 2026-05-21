import React from 'react';
import type { GanttApi } from 'wx-react-gantt';
import type { WorkingCalendarResponse } from '@project-workgroup/shared';

interface Props {
  api: GanttApi | null;
  calendar: WorkingCalendarResponse | null;
  containerRef: React.RefObject<HTMLElement | null>;
}

interface SnapHint {
  taskId: string | number;
  message: string;
  x: number;
  y: number;
}

const SNAP_THRESHOLD_MS = 30 * 60 * 1000;
const HINT_DURATION_MS = 1500;

const formatHourMinute = (date: Date): string => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const buildMessage = (originalStart: Date, snappedStart: Date, calendar: WorkingCalendarResponse | null): string => {
  const time = formatHourMinute(snappedStart);
  const weekday = snappedStart.getDay();
  const pattern = calendar?.patterns.find((p) => p.weekday === weekday);
  if (pattern?.dayStart && pattern.dayStart.startsWith(time.slice(0, 2))) {
    return `Ajustado a ${time} (inicio de jornada)`;
  }
  if (pattern?.dayEnd && pattern.dayEnd.startsWith(time.slice(0, 2))) {
    return `Ajustado a ${time} (cierre de jornada)`;
  }
  if (originalStart.toDateString() !== snappedStart.toDateString()) {
    return `Ajustado al día laboral más cercano`;
  }
  return `Ajustado a ${time}`;
};

const GanttSnapOverlay: React.FC<Props> = ({ api, calendar, containerRef }) => {
  const [hint, setHint] = React.useState<SnapHint | null>(null);
  const hintTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragSnapshotsRef = React.useRef<Map<string, { start: Date; end: Date }>>(new Map());

  React.useEffect(() => {
    if (!api) return undefined;
    const snapshots = dragSnapshotsRef.current;

    const onUpdate = (event: { id: string | number; task?: { start?: Date | string; end?: Date | string }; inProgress?: boolean; _silent?: boolean; _rollback?: boolean }) => {
      if (event._silent || event._rollback) return;
      if (event.inProgress) {
        const key = String(event.id);
        if (!snapshots.has(key)) {
          const t = api.getTask?.(event.id);
          if (t?.start instanceof Date && t?.end instanceof Date) {
            snapshots.set(key, { start: t.start, end: t.end });
          }
        }
        return;
      }
      const key = String(event.id);
      const snap = snapshots.get(key);
      snapshots.delete(key);
      if (!snap) return;
      const dropped = event.task?.start
        ? event.task.start instanceof Date
          ? event.task.start
          : new Date(event.task.start)
        : null;
      const finalTask = api.getTask?.(event.id);
      const finalStart = finalTask?.start instanceof Date ? finalTask.start : null;
      if (!dropped || !finalStart) return;
      const drift = Math.abs(finalStart.getTime() - dropped.getTime());
      if (drift < SNAP_THRESHOLD_MS) return;

      const container = containerRef.current;
      const barEl = container?.querySelector(`.wx-bar[data-id="${event.id}"], [data-task-id="${event.id}"] .wx-bar`) as HTMLElement | null;
      const containerRect = container?.getBoundingClientRect();
      const barRect = barEl?.getBoundingClientRect();
      if (containerRect && barRect && barEl) {
        barEl.classList.remove('snap-pulse');
        void barEl.offsetWidth;
        barEl.classList.add('snap-pulse');
        setHint({
          taskId: event.id,
          message: buildMessage(snap.start, finalStart, calendar),
          x: barRect.left - containerRect.left + barRect.width / 2,
          y: barRect.top - containerRect.top,
        });
      } else {
        setHint({
          taskId: event.id,
          message: buildMessage(snap.start, finalStart, calendar),
          x: 80,
          y: 80,
        });
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pwg:gantt:snap', {
          detail: {
            taskId: String(event.id),
            droppedAt: dropped.toISOString(),
            snappedTo: finalStart.toISOString(),
            driftMs: drift,
          },
        }));
      }
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      hintTimerRef.current = setTimeout(() => setHint(null), HINT_DURATION_MS);
    };

    const onMove = (event: { id: string | number; inProgress?: boolean }) => {
      if (event.inProgress) return;
      snapshots.delete(String(event.id));
    };

    api.on('update-task', onUpdate);
    api.on('move-task', onMove);

    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      snapshots.clear();
    };
  }, [api, calendar, containerRef]);

  if (!hint) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="gantt-snap-hint"
      style={{
        position: 'absolute',
        left: hint.x,
        top: Math.max(0, hint.y - 28),
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      {hint.message}
    </div>
  );
};

export default GanttSnapOverlay;
