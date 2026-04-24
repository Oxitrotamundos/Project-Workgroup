import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const PROJECT_STATUSES = ['planning', 'active', 'completed', 'on-hold'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export class CreateProjectDto {
  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsIn(PROJECT_STATUSES)
  status!: ProjectStatus;

  @IsString() @MinLength(1)
  color!: string;
}

export class UpdateProjectDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional() @IsIn(PROJECT_STATUSES)
  status?: ProjectStatus;

  @IsOptional() @IsString() @MinLength(1)
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
