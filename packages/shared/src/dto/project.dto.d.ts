export declare const PROJECT_STATUSES: readonly ["planning", "active", "completed", "on-hold"];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export declare class CreateProjectDto {
    name: string;
    description?: string;
    startDate: string;
    endDate: string;
    status: ProjectStatus;
    color: string;
}
export declare class UpdateProjectDto {
    name?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    status?: ProjectStatus;
    color?: string;
}
export interface ProjectResponse {
    id: string;
    name: string;
    description: string | null;
    startDate: string;
    endDate: string;
    status: ProjectStatus;
    ownerId: string;
    color: string;
    createdAt: string;
    updatedAt: string;
}
export declare const TIME_GRANULARITIES: readonly ["hours", "days"];
export type TimeGranularity = (typeof TIME_GRANULARITIES)[number];
export interface ProjectSettingsResponse {
    projectId: string;
    timeGranularity: TimeGranularity;
    createdAt: string;
    updatedAt: string;
}
export declare class UpdateProjectSettingsDto {
    timeGranularity?: TimeGranularity;
}
