export declare const TASK_LINK_TYPES: readonly ["e2s", "s2s", "e2e", "s2e"];
export type TaskLinkType = (typeof TASK_LINK_TYPES)[number];
export declare class CreateTaskLinkDto {
    sourceTaskId: string;
    targetTaskId: string;
    type: TaskLinkType;
}
export declare class UpdateTaskLinkDto {
    type?: TaskLinkType;
    expectedVersion?: number;
}
export interface TaskLinkResponse {
    id: string;
    projectId: string;
    sourceTaskId: string;
    targetTaskId: string;
    type: TaskLinkType;
    version: number;
    createdAt: string;
    updatedAt: string;
}
