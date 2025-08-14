declare module 'wx-react-gantt' {
  import { ComponentType, ReactNode } from 'react';

  export interface GanttTask {
    id: number;
    text: string;
    start: Date;
    end: Date;
    duration: number;
    progress: number;
    type?: 'task' | 'summary' | 'milestone';
    parent?: number;
    lazy?: boolean;
  }

  export interface GanttLink {
    id: number;
    source: number;
    target: number;
    type: 'e2s' | 's2s' | 'e2e' | 's2e';
  }

  export interface GanttScale {
    unit: 'day' | 'week' | 'month' | 'year';
    step: number;
    format: string;
    css?: string;
  }

  export interface GanttProps {
    tasks?: GanttTask[];
    links?: GanttLink[];
    scales?: GanttScale[];
    columns?: any[];
    start?: Date;
    end?: Date;
    cellWidth?: number;
    cellHeight?: number;
    readonly?: boolean;
    init?: (api: any) => void;
    onTaskClick?: (task: GanttTask) => void;
    onTaskDblClick?: (task: GanttTask) => void;
    onLinkClick?: (link: GanttLink) => void;
    onTaskAdd?: (task: GanttTask) => void;
    onTaskUpdate?: (task: GanttTask) => void;
    onTaskDelete?: (task: GanttTask) => void;
    onLinkAdd?: (link: GanttLink) => void;
    onLinkUpdate?: (link: GanttLink) => void;
    onLinkDelete?: (link: GanttLink) => void;
  }

  export interface WillowProps {
    children: ReactNode;
  }

  export interface WillowDarkProps {
    children: ReactNode;
  }

  export interface ToolbarItem {
    id?: string;
    comp?: string;
    text?: string;
    icon?: string;
    type?: string;
    css?: string;
    layout?: string;
    items?: ToolbarItem[];
    handler?: (api: any) => void;
  }

  export interface ToolbarProps {
    api?: any;
    items?: ToolbarItem[];
  }

  export const Gantt: ComponentType<GanttProps>;
  export const Willow: ComponentType<WillowProps>;
  export const WillowDark: ComponentType<WillowDarkProps>;
  export const Toolbar: ComponentType<ToolbarProps>;
  export const defaultToolbarButtons: ToolbarItem[];
}

declare module 'wx-react-gantt/dist/gantt.css';