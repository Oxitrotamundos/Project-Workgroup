import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsOptional() @IsInt() @Min(1)
  expectedVersion?: number;
}

export class UpdateProgressDto {
  @IsInt() @Min(0) @Max(100)
  progress!: number;

  @IsOptional() @IsInt() @Min(1)
  expectedVersion?: number;
}

export class UpdateOrderDto {
  @IsOptional() @IsString()
  afterTaskId?: string;

  @IsOptional() @IsString()
  beforeTaskId?: string;

  @IsOptional() @IsInt() @Min(1)
  expectedVersion?: number;
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
  version: number;
  createdAt: string;
  updatedAt: string;
}

export class BulkTaskUpdateItemDto {
  @IsString()
  id!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => UpdateTaskDto)
  data!: UpdateTaskDto;

  @IsOptional() @IsInt() @Min(1)
  expectedVersion?: number;
}

export class BulkTaskUpdateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => BulkTaskUpdateItemDto)
  updates!: BulkTaskUpdateItemDto[];
}

export interface SummaryPatch {
  id: string;
  startDate: string;
  endDate: string;
  duration: string;
  progress: number;
  version: number;
}

export interface BulkTaskUpdateResponse {
  tasks: TaskResponse[];
  summariesPatched: SummaryPatch[];
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

export class ApplyPropagationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PropagationApplyItemDto)
  changes!: PropagationApplyItemDto[];
}

export class PropagationApplyItemDto {
  @IsString()
  taskId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional() @IsInt() @Min(1)
  expectedVersion?: number;
}
