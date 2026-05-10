import { useRef, useMemo, useEffect, useState, useCallback, type FC } from 'react';
import type { GanttApi, GanttTask } from 'wx-react-gantt';

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

interface GanttTimelineProps {
  scrollLeft: number;
  api: GanttApi | null;
  tasks: GanttTask[];
  zoomLevel: number;
  zoomLabel: string;
}

const TASK_COLORS: Record<string, string> = {
  summary: 'rgba(6,182,212,0.7)',
  milestone: 'rgba(139,92,246,0.8)',
  task: 'rgba(99,102,241,0.6)',
};

export const GanttTimeline: FC<GanttTimelineProps> = ({
  scrollLeft,
  api,
  tasks,
  zoomLevel,
  zoomLabel,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(0);
  const [chartScrollWidth, setChartScrollWidth] = useState(0);
  const [chartViewportWidth, setChartViewportWidth] = useState(0);
  const [isPanning, setIsPanning] = useState(false);

  const dragStateRef = useRef({
    startX: 0,
    startThumbLeft: 0,
    startContainerW: 0,
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

      const chartEl =
        (document.querySelector('.gantt-container .wx-chart') as HTMLElement | null) ||
        (document.querySelector('.gantt-container .wx-chart-scroll') as HTMLElement | null);
      const areaEl = document.querySelector('.gantt-container .wx-area') as HTMLElement | null;
      if (chartEl) {
        const total = areaEl?.getBoundingClientRect().width ?? chartEl.scrollWidth;
        setChartScrollWidth(total);
        setChartViewportWidth(chartEl.clientWidth);
      }
    };

    measure();
    const id = window.setTimeout(measure, 100);
    const ro = new ResizeObserver(measure);
    const ganttContainer = trackRef.current?.closest('.gantt-container');
    if (ganttContainer) ro.observe(ganttContainer);
    const areaEl = document.querySelector('.gantt-container .wx-area') as HTMLElement | null;
    if (areaEl) ro.observe(areaEl);
    return () => {
      window.clearTimeout(id);
      ro.disconnect();
    };
  }, [zoomLevel, tasks]);

  const minimapBars = useMemo(() => {
    if (!tasks.length) return [];
    const starts = tasks.map((t) => t.start.getTime());
    const ends = tasks.map((t) => t.end.getTime());
    const firstMs = Math.min(...starts);
    const lastMs = Math.max(...ends);
    const rangeMs = lastMs - firstMs;
    if (rangeMs <= 0) return [];
    return tasks
      .filter((t) => t.type !== 'summary')
      .map((t) => ({
        id: t.id,
        left: ((t.start.getTime() - firstMs) / rangeMs) * 100,
        width: Math.max(((t.end.getTime() - t.start.getTime()) / rangeMs) * 100, 0.8),
        type: t.type ?? 'task',
      }));
  }, [tasks]);

  const thumbW =
    chartScrollWidth > 0 && chartViewportWidth > 0 && containerWidth > 0
      ? clamp(
          (chartViewportWidth / chartScrollWidth) * containerWidth,
          containerWidth * 0.08,
          containerWidth,
        )
      : containerWidth;
  const thumbLeft =
    chartScrollWidth > 0 && containerWidth > 0
      ? clamp(
          (scrollLeft / chartScrollWidth) * containerWidth,
          0,
          Math.max(containerWidth - thumbW, 0),
        )
      : 0;

  const fullyVisible = chartScrollWidth <= 0 || thumbW >= containerWidth * 0.98;

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragStateRef.current = {
        startX: e.clientX,
        startThumbLeft: thumbLeft,
        startContainerW: containerWidth,
      };
      setIsPanning(true);
    },
    [thumbLeft, containerWidth],
  );

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      const { startX, startThumbLeft, startContainerW } = dragStateRef.current;
      const deltaX = e.clientX - startX;
      const newLeft = clamp(startThumbLeft + deltaX, 0, Math.max(startContainerW - thumbW, 0));
      const newScrollLeft =
        startContainerW > 0 ? (newLeft / startContainerW) * chartScrollWidth : 0;
      api?.exec('scroll-chart', { left: Math.max(0, newScrollLeft) });
    };
    const onUp = () => setIsPanning(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning, thumbW, chartScrollWidth, api]);

  if (!tasks.length) return null;

  return (
    <div className="gantt-timeline" style={{ paddingLeft: sidebarWidth }}>
      <div className="gantt-timeline__zoom-badge">
        <span className="gantt-timeline__zoom-icon">⊕</span>
        <span>{zoomLabel}</span>
      </div>

      <div
        className={`gantt-timeline__track${isPanning ? ' gantt-timeline__track--dragging' : ''}`}
        ref={trackRef}
      >
        <div className="gantt-timeline__minimap" aria-hidden="true">
          {minimapBars.map((bar) => (
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
          className={`gantt-timeline__thumb${isPanning ? ' gantt-timeline__thumb--panning' : ''}`}
          style={{
            left: thumbLeft,
            width: thumbW,
            transition: isPanning ? 'none' : 'left 0.08s ease, width 0.08s ease',
          }}
        >
          <div
            className={`gantt-timeline__center${isPanning ? ' gantt-timeline__center--active' : ''}`}
            onMouseDown={fullyVisible ? undefined : startDrag}
            style={fullyVisible ? { cursor: 'default' } : undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default GanttTimeline;
