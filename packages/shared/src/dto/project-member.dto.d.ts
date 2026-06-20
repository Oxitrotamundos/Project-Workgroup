export declare const PROJECT_ROLES: readonly ["manager", "contributor", "viewer"];
export type ProjectRole = (typeof PROJECT_ROLES)[number];
export declare class AddProjectMemberDto {
    userId: string;
    projectRole: ProjectRole;
}
export interface ProjectMemberResponse {
    projectId: string;
    userId: string;
    projectRole: ProjectRole;
    createdAt: string;
}
