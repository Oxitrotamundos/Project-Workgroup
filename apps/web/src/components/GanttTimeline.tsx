import { useRef, useMemo, useEffect, useState, useCallback, type FC } from 'react';
import type { GanttApi, GanttTask } from 'wx-react-gantt';

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

type DragType = 'left' | 'center' | 'right';

interface GanttTimelineProps {
  cellWidth: number;
  onCellWidthChange: (w: number) => void;
  scrollLeft: number;
  api: GanttApi | null;
  tasks: GanttTask[];
  minCellWidth?: number;
  maxCellWidth?: number;
}

const TASK_COLORS: Record<string, string> = {
  summary: 'rgba(6,182,212,0.7)',
  milestone: 'rgba(139,92,246,0.8)',
  task: 'rgba(99,102,241,0.6)',
};

export const GanttTimeline: FC<GanttTimelineProps> = ({
  cellWidth,
  onCellWidthChange,
  scrollLeft,
  api,
  tasks,
  minCellWidth = 15,
  maxCellWidth = 120,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(0);
  const [dragType, setDragType] = useState<DragType | null>(null);
  const [hoverHandle, setHoverHandle] = useState<'left' | 'right' | null>(null);

  const dragStateRef = useRef({
    startX: 0,
    startThumbLeft: 0,
    startThumbW: 0,
    startContainerW: 0,
    startTotalDays: 0,
    startTotalPx: 0,
  });

  useEffect(() => {
    const measure = () => {
      const grid = document.querySelector('.wx-grid');
      const sidebar = grid ? grid.getBoundingClientRect().width : 0;
      setSidebarWidth(sidebar);
      const ganttContainer = trackRef.current?.closest('.gantt-container');
      if (ganttContainer) {
        setContainerWidth(ganttContainer.getBoundingClientRect().width - sidebar);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    const ganttContainer = trackRef.current?.closest('.gantt-container');
    if (ganttContainer) ro.observe(ganttContainer);
    return () => ro.disconnect();
  }, []);

  const { totalDays, minimapBars } = useMemo(() => {
    if (!tasks.length) return { totalDays: 30, minimapBars: [] };

    const starts = tasks.map(t => t.start.getTime());
    const ends = tasks.map(t => t.end.getTime());
    const firstMs = Math.min(...starts);
    const lastMs = Math.max(...ends);
    const rangeMs = lastMs - firstMs;
    const days = Math.max(Math.ceil(rangeMs / 86_400_000) + 7, 30);

    const bars = rangeMs > 0
      ? tasks
          .filter(t => t.type !== 'summary')
          .map(t => ({
            id: t.id,
            left: ((t.start.getTime() - firstMs) / rangeMs) * 100,
            width: Math.max(((t.end.getTime() - t.start.getTime()) / rangeMs) * 100, 0.8),
            type: t.type ?? 'task',
          }))
      : [];

    return { totalDays: days, minimapBars: bars };
  }, [tasks]);

  const totalPx = totalDays * cellWidth;
  const thumbW = containerWidth > 0 && totalPx > 0
    ? clamp((containerWidth / totalPx) * containerWidth, containerWidth * 0.08, containerWidth)
    : containerWidth;
  const thumbLeft = totalPx > 0
    ? clamp((scrollLeft / totalPx) * containerWidth, 0, containerWidth - thumbW)
    : 0;

  const fullyVisible = thumbW >= containerWidth * 0.98;
  const leftDisabled = cellWidth <= minCellWidth;
  const rightDisabled = cellWidth >= maxCellWidth;

  const zoomPct = Math.round((cellWidth / 30) * 100);

  const startDrag = useCallback(
    (type: DragType) => (e: React.MouseEvent) => {
      e.preventDefault();
      dragStateRef.current = {
        startX: e.clientX,
        startThumbLeft: thumbLeft,
        startThumbW: thumbW,
        startContainerW: containerWidth,
        startTotalDays: totalDays,
        startTotalPx: totalPx,
      };
      setDragType(type);
    },
    [thumbLeft, thumbW, containerWidth, totalDays, totalPx],
  );

  useEffect(() => {
    if (!dragType) return;

    const onMove = (e: MouseEvent) => {
      const { startX, startThumbLeft, startThumbW, startContainerW, startTotalDays, startTotalPx } =
        dragStateRef.current;
      const deltaX = e.clientX - startX;

      if (dragType === 'center') {
        const newLeft = clamp(startThumbLeft + deltaX, 0, startContainerW - startThumbW);
        api?.exec('scroll-chart', { left: Math.max(0, (newLeft / startContainerW) * startTotalPx) });
        return;
      }

      if (dragType === 'right') {
        const newThumbW = Math.max(startThumbW + deltaX, startContainerW * 0.08);
        onCellWidthChange(clamp((startContainerW * startContainerW) / (startTotalDays * newThumbW), minCellWidth, maxCellWidth));
        return;
      }

      const newThumbW = Math.max(startThumbW - deltaX, startContainerW * 0.08);
      const newLeft = clamp(startThumbLeft + deltaX, 0, Math.max(startContainerW - newThumbW, 0));
      onCellWidthChange(clamp((startContainerW * startContainerW) / (startTotalDays * newThumbW), minCellWidth, maxCellWidth));
      api?.exec('scroll-chart', { left: Math.max(0, (newLeft / startContainerW) * startTotalPx) });
    };

    const onUp = () => setDragType(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragType, api, minCellWidth, maxCellWidth, onCellWidthChange]);

  if (!tasks.length) return null;

  const isDragging = dragType !== null;

  return (
    <div className="gantt-timeline" style={{ paddingLeft: sidebarWidth }}>
      <div className="gantt-timeline__zoom-badge">
        <span className="gantt-timeline__zoom-icon">⊕</span>
        <span>{zoomPct}%</span>
      </div>

      <div
        className={`gantt-timeline__track${isDragging ? ' gantt-timeline__track--dragging' : ''}`}
        ref={trackRef}
      >
        <div className="gantt-timeline__minimap" aria-hidden="true">
          {minimapBars.map(bar => (
            <div
              key={bar.id}
              className="gantt-timeline__minibar"
              style={{
                left: `${bar.left}%`,
                width: `${bar.width}%`,
                background: TASK_COLORS[bar.type] ?? TASK_COLORS.task,
                height: bar.type === 'summary' ? '5px' : '4px',
                top: bar.type === 'summary' ? '8px' : '11px',
              }}
            />
          ))}
        </div>

        <div
          className={`gantt-timeline__thumb${isDragging && dragType === 'center' ? ' gantt-timeline__thumb--panning' : ''}`}
          style={{
            left: thumbLeft,
            width: thumbW,
            transition: isDragging ? 'none' : 'left 0.08s ease, width 0.08s ease',
          }}
        >
          <div
            className={`gantt-timeline__handle gantt-timeline__handle--left${leftDisabled ? ' gantt-timeline__handle--disabled' : ''}${dragType === 'left' ? ' gantt-timeline__handle--active' : ''}`}
            onMouseDown={leftDisabled ? undefined : startDrag('left')}
            onMouseEnter={() => !leftDisabled && setHoverHandle('left')}
            onMouseLeave={() => setHoverHandle(null)}
          >
            <span className="gantt-timeline__grip" />
            <span className="gantt-timeline__grip" />
            <span className="gantt-timeline__grip" />
          </div>

          <div
            className={`gantt-timeline__center${dragType === 'center' ? ' gantt-timeline__center--active' : ''}`}
            onMouseDown={fullyVisible ? undefined : startDrag('center')}
            style={fullyVisible ? { cursor: 'default' } : undefined}
          />

          <div
            className={`gantt-timeline__handle gantt-timeline__handle--right${rightDisabled ? ' gantt-timeline__handle--disabled' : ''}${dragType === 'right' ? ' gantt-timeline__handle--active' : ''}`}
            onMouseDown={rightDisabled ? undefined : startDrag('right')}
            onMouseEnter={() => !rightDisabled && setHoverHandle('right')}
            onMouseLeave={() => setHoverHandle(null)}
          >
            <span className="gantt-timeline__grip" />
            <span className="gantt-timeline__grip" />
            <span className="gantt-timeline__grip" />
          </div>
        </div>

        {hoverHandle && !isDragging && (
          <div
            className="gantt-timeline__tooltip"
            style={{
              left: hoverHandle === 'left' ? thumbLeft + 6 : thumbLeft + thumbW - 6,
            }}
          >
            {Math.round(cellWidth)}px/día
          </div>
        )}
      </div>
    </div>
  );
};

export default GanttTimeline;
