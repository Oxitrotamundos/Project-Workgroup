export declare class CreateWorkloadDto {
    userId: string;
    taskId: string;
    date: string;
    allocatedHours: string;
    actualHours?: string;
}
export declare class WorkloadQueryDto {
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
}
export interface WorkloadResponse {
    id: string;
    userId: string;
    taskId: string;
    projectId: string;
    date: string;
    allocatedHours: string;
    actualHours: string | null;
    createdAt: string;
    updatedAt: string;
}
