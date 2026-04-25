import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const TASK_STATUSES = ['not-started', 'in-progress', 'completed', 'blocked'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_TYPES = ['task', 'summary', 'milestone'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export class CreateTaskDto {
  @IsString() @MinLength(1) @MaxLength(500)
  name!: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsIn(TASK_PRIORITIES)
  priority!: TaskPriority;

  @IsIn(TASK_STATUSES)
  status!: TaskStatus;

  @IsIn(TASK_TYPES)
  type!: TaskType;

  @IsString() @MinLength(1)
  color!: string;

  @IsOptional() @IsString()
  parentId?: string;

  @IsOptional() @IsString()
  assigneeId?: string;

  @IsOptional() @IsString()
  afterTaskId?: string;
}

export class UpdateTaskDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(500)
  name?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional() @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @IsOptional() @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @IsOptional() @IsIn(TASK_TYPES)
  type?: TaskType;

  @IsOptional() @IsString() @MinLength(1)
  color?: string;

  @IsOptional() @IsString()
  assigneeId?: string;

  @IsOptional() @IsBoolean()
  open?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  parentId?: string | null;
}

export class UpdateProgressDto {
  @IsInt() @Min(0) @Max(100)
  progress!: number;
}

export class UpdateOrderDto {
  @IsOptional() @IsString()
  afterTaskId?: string;

  @IsOptional() @IsString()
  beforeTaskId?: string;
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
  createdAt: string;
  updatedAt: string;
}
