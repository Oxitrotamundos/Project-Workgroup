import { IsIn, IsString } from 'class-validator';
import { UserResponse } from './user.dto';

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
  user: UserResponse;
  createdAt: string;
}

export class UpdateProjectMemberDto {
  @IsIn(PROJECT_ROLES)
  projectRole!: ProjectRole;
}
