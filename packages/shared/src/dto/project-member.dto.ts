import { IsIn, IsString } from 'class-validator';

export const PROJECT_ROLES = ['manager', 'contributor', 'viewer'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export class AddProjectMemberDto {
  @IsString()
  userId!: string;

  @IsIn(PROJECT_ROLES)
  projectRole!: ProjectRole;
}

export interface ProjectMemberResponse {
  projectId: string;
  userId: string;
  projectRole: ProjectRole;
  createdAt: string;
}
