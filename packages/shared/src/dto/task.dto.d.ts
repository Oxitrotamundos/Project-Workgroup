export declare const TASK_STATUSES: readonly ["not-started", "in-progress", "completed", "blocked"];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export declare const TASK_PRIORITIES: readonly ["low", "medium", "high", "critical"];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export declare const TASK_TYPES: readonly ["task", "summary", "milestone"];
export type TaskType = (typeof TASK_TYPES)[number];
export declare class CreateTaskDto {
    name: string;
    description?: string;
    startDate: string;
    endDate?: string;
    priority: TaskPriority;
    status: TaskStatus;
    type: TaskType;
    color: string;
    parentId?: string;
    assigneeId?: string;
    afterTaskId?: string;
    estimatedHours?: string;
}
export declare class UpdateTaskDto {
    name?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    priority?: TaskPriority;
    status?: TaskStatus;
    type?: TaskType;
    progress?: number;
    color?: string;
    assigneeId?: string;
    open?: boolean;
    parentId?: string | null;
    expectedVersion?: number;
    estimatedHours?: string;
}
export declare class UpdateProgressDto {
    progress: number;
    expectedVersion?: number;
}
export declare class UpdateOrderDto {
    afterTaskId?: string;
    beforeTaskId?: string;
    expectedVersion?: number;
}
export declare class UpdateTaskPositionDto {
    parentId?: string | null;
    afterTaskId?: string;
    beforeTaskId?: string;
    expectedVersion?: number;
}
export declare class TaskOpenStateDto {
    id: string;
    open: boolean;
    expectedVersion?: number;
}
export declare class BulkTaskOpenStateDto {
    states: TaskOpenStateDto[];
}
export interface TaskResponse {
    id: string;
    projectId: string;
    parentId: string | null;
    assigneeId: string | null;
    name: string;
    description: string | null;
    startDate: string;
    endDate: string;
    /** @deprecated Derivable de estimatedHours / hoursPerDay. Se eliminará en una versión futura. */
    duration: string;
    progress: number;
    priority: TaskPriority;
    status: TaskStatus;
    type: TaskType;
    color: string;
    order: string;
    open: boolean;
    tags: string[];
    estimatedHours: string;
    actualHours: string | null;
    /** Horas efectivas por día laboral del calendario resuelto para este proyecto. */
    hoursPerDay: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}
export declare class BulkTaskUpdateItemDto {
    id: string;
    data: UpdateTaskDto;
    expectedVersion?: number;
}
export declare class BulkTaskUpdateDto {
    updates: BulkTaskUpdateItemDto[];
}
export interface SummaryPatch {
    id: string;
    startDate: string;
    endDate: string;
    duration: string;
    progress: number;
    estimatedHours: string;
    version: number;
}
export interface TaskMutationResponse extends TaskResponse {
    summariesPatched?: SummaryPatch[];
}
export interface BulkTaskUpdateResponse {
    tasks: TaskResponse[];
    summariesPatched: SummaryPatch[];
}
export interface BulkTaskOpenStateConflict {
    id: string;
    currentVersion: number;
    expectedVersion: number;
}
export interface BulkTaskOpenStateResponse {
    updated: Array<{
        id: string;
        open: boolean;
        version: number;
    }>;
    conflicts?: BulkTaskOpenStateConflict[];
}
export interface PropagationChange {
    taskId: string;
    currentVersion: number;
    currentStartDate: string;
    currentEndDate: string;
    proposedStartDate: string;
    proposedEndDate: string;
    via: 'e2s' | 's2s' | 'e2e' | 's2e';
    fromTaskId: string;
}
export interface PropagationPreview {
    sourceTaskId: string;
    changes: PropagationChange[];
}
export declare class ApplyPropagationDto {
    changes: PropagationApplyItemDto[];
}
export declare class PropagationApplyItemDto {
    taskId: string;
    startDate: string;
    endDate: string;
    expectedVersion?: number;
}
