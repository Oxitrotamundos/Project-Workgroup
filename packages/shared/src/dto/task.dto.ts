import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumberString,
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

  @IsOptional() @IsDateString()
  endDate?: string;

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

  // Esfuerzo en horas. Si viene, endDate se computa desde el calendario.
  @IsOptional() @IsNumberString({ no_symbols: false })
  estimatedHours?: string;
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

  @IsOptional() @IsInt() @Min(0) @Max(100)
  progress?: number;

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

  @IsOptional() @IsNumberString({ no_symbols: false })
  estimatedHours?: string;
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

export class UpdateTaskPositionDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  parentId?: string | null;

  @IsOptional() @IsString()
  afterTaskId?: string;

  @IsOptional() @IsString()
  beforeTaskId?: string;

  @IsOptional() @IsInt() @Min(1)
  expectedVersion?: number;
}

export class TaskOpenStateDto {
  @IsString()
  id!: string;

  @IsBoolean()
  open!: boolean;
}

export class BulkTaskOpenStateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TaskOpenStateDto)
  states!: TaskOpenStateDto[];
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

export interface BulkTaskOpenStateResponse {
  updated: Array<{ id: string; open: boolean }>;
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
