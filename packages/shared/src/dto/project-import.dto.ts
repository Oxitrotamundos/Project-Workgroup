// packages/shared/src/dto/project-import.dto.ts
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProjectDto, ProjectResponse } from './project.dto';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  TaskPriority,
  TaskStatus,
  TaskType,
} from './task.dto';

export const IMPORT_LINK_TYPES = ['e2s', 's2s', 'e2e', 's2e'] as const;
export type ImportLinkType = (typeof IMPORT_LINK_TYPES)[number];

export class ImportTaskDto {
  // Referencia local para enlazar jerarquía y dependencias antes de tener ids reales.
  @IsString() @MinLength(1) @MaxLength(120)
  ref!: string;

  @IsString() @MinLength(1) @MaxLength(500)
  name!: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @IsIn(TASK_TYPES)
  type!: TaskType;

  @IsDateString()
  startDate!: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsIn(TASK_PRIORITIES)
  priority!: TaskPriority;

  @IsIn(TASK_STATUSES)
  status!: TaskStatus;

  @IsString() @MinLength(1)
  color!: string;

  @IsOptional() @IsString() @MaxLength(120)
  parentRef?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20)
  tags?: string[];

  @IsOptional() @IsNumberString({ no_symbols: false })
  estimatedHours?: string;
}

export class ImportDependencyDto {
  @IsString() @MinLength(1)
  fromRef!: string;

  @IsString() @MinLength(1)
  toRef!: string;

  @IsIn(IMPORT_LINK_TYPES)
  type!: ImportLinkType;
}

export class ImportProjectDto {
  @ValidateNested() @Type(() => CreateProjectDto)
  project!: CreateProjectDto;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => ImportTaskDto)
  tasks!: ImportTaskDto[];

  @IsOptional() @IsArray() @ArrayMaxSize(1000)
  @ValidateNested({ each: true }) @Type(() => ImportDependencyDto)
  dependencies?: ImportDependencyDto[];
}

export interface ImportProjectResponse {
  project: ProjectResponse;
  taskRefToId: Record<string, string>;
  taskCount: number;
  dependencyCount: number;
}
