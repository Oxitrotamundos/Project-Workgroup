declare module 'wx-react-gantt' {
  import { ComponentType, ReactNode } from 'react';

  export type GanttTaskType = 'task' | 'summary' | 'milestone';
  export type GanttLinkType = 'e2s' | 's2s' | 'e2e' | 's2e';
  export type GanttId = number | string;

  export interface GanttTask {
    id: GanttId;
    text: string;
    start: Date;
    end: Date;
    duration: number;
    progress: number;
    type?: GanttTaskType;
    parent?: GanttId;
    open?: boolean;
    lazy?: boolean;
    data?: GanttTask[];
    details?: string;
    estimatedHours?: number;
    hoursPerDay?: number;
    [key: string]: unknown;
  }

  export interface GanttLink {
    id: GanttId;
    source: GanttId;
    target: GanttId;
    type: GanttLinkType;
  }

  export interface GanttScale {
    unit: 'day' | 'week' | 'month' | 'year';
    step: number;
    format: string;
    css?: string;
  }

  export interface GanttMarker {
    start: Date;
    text: string;
    css?: string;
  }

  export interface GanttColumn {
    id: string;
    header: string;
    flexGrow?: number;
    align?: 'left' | 'center' | 'right';
    width?: number;
    template?: (value: unknown, task: GanttTask, col: GanttColumn) => string;
  }

  export interface GanttActionPayloadMap {
    'add-task': {
      id?: GanttId;
      mode?: 'child' | 'after' | 'before';
      target?: GanttId;
      text?: string;
      start?: Date;
      end?: Date;
      duration?: number;
      type?: GanttTaskType;
      details?: string;
      parent?: GanttId;
      progress?: number;
      _silent?: boolean;
    };
    'update-task': {
      id: GanttId;
      task?: Partial<GanttTask>;
      eventSource?: string;
      inProgress?: boolean;
      _rollback?: boolean;
      _silent?: boolean;
      _addTaskSync?: boolean;
    };
    'delete-task': {
      id: GanttId;
      source?: GanttId;
      _silent?: boolean;
    };
    'move-task': {
      id: GanttId;
      source?: GanttId;
      target?: GanttId;
      mode?: 'child' | 'after' | 'before';
      inProgress?: boolean;
      _silent?: boolean;
    };
    'drag-task': {
      id: GanttId;
      inProgress?: boolean;
      width?: number;
      left?: number;
      top?: number;
    };
    'copy-task': { id: GanttId; source?: GanttId };
    'select-task': { id: GanttId };
    'unselect-task': { id?: GanttId };
    'open-task': { id: GanttId; _fromRestore?: boolean };
    'close-task': { id: GanttId; _fromRestore?: boolean };
    'expand-task': { id?: GanttId };
    'collapse-task': { id?: GanttId };
    'scroll-chart': { left?: number; top?: number };
    'expand-scale': Record<string, unknown>;
    'show-editor': { id?: GanttId };
    'hide-editor': Record<string, unknown>;
    'render-data': Record<string, unknown>;
    'add-link': {
      id?: GanttId;
      link?: Partial<GanttLink>;
      source?: GanttId;
      target?: GanttId;
      type?: GanttLinkType;
      _silent?: boolean;
    };
    'update-link': {
      id: GanttId;
      link?: Partial<GanttLink>;
      _silent?: boolean;
    };
    'delete-link': {
      id: GanttId;
      source?: GanttId;
      target?: GanttId;
      _silent?: boolean;
    };
  }

  export type GanttAction = keyof GanttActionPayloadMap;
  export type GanttHandler<A extends GanttAction> = (
    data: GanttActionPayloadMap[A],
  ) => unknown | false | Promise<unknown | false>;

  export interface GanttDataChain {
    send(action: string, data: unknown): unknown;
  }

  export interface GanttState {
    tasks: GanttTask[];
    _tasks?: GanttTask[];
    links?: GanttLink[];
    [key: string]: unknown;
  }

  export interface GanttApi {
    on<A extends GanttAction>(action: A, handler: GanttHandler<A>): void;
    intercept<A extends GanttAction>(action: A, handler: GanttHandler<A>): void;
    exec<A extends GanttAction>(action: A, data: GanttActionPayloadMap[A]): unknown;
    getTask(id: GanttId): GanttTask | undefined;
    getLink(id: GanttId): GanttLink | undefined;
    getState(): GanttState;
    setNext(provider: GanttDataChain): void;
    setLocale?: (locale: unknown) => void;
    config?: { locale?: unknown };
  }

  export interface GanttProps {
    tasks?: GanttTask[];
    links?: GanttLink[];
    scales?: GanttScale[];
    columns?: GanttColumn[];
    markers?: GanttMarker[];
    start?: Date;
    end?: Date;
    cellWidth?: number;
    cellHeight?: number;
    lengthUnit?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
    readonly?: boolean;
    highlightTime?: (date: Date, unit: string) => string;
    init?: (api: GanttApi) => void;
    api?: GanttApi;
    apiRef?: { current: GanttApi | null };
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
    handler?: (api: GanttApi) => void;
  }

  export interface ToolbarProps {
    api?: GanttApi | null;
    items?: ToolbarItem[];
  }

  export const Gantt: ComponentType<GanttProps>;
  export const Willow: ComponentType<WillowProps>;
  export const WillowDark: ComponentType<WillowDarkProps>;
  export const Toolbar: ComponentType<ToolbarProps>;
  export const defaultToolbarButtons: ToolbarItem[];
}

declare module 'wx-react-gantt/dist/gantt.css';
