import { IsDateString, IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateWorkloadDto {
  @IsString()
  resourceId!: string;

  @IsString()
  taskId!: string;

  @IsDateString()
  date!: string;

  @IsNumberString()
  allocatedHours!: string;

  @IsOptional() @IsNumberString()
  actualHours?: string;
}

export class WorkloadQueryDto {
  @IsOptional() @IsString()
  resourceId?: string;

  @IsOptional() @IsDateString()
  dateFrom?: string;

  @IsOptional() @IsDateString()
  dateTo?: string;
}

export interface WorkloadResponse {
  id: string;
  resourceId: string;
  taskId: string;
  projectId: string;
  date: string;
  allocatedHours: string;
  actualHours: string | null;
  createdAt: string;
  updatedAt: string;
}
