import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const RESOURCE_KINDS = ['user', 'placeholder'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const RESOURCE_STATUSES = ['active', 'inactive'] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export class CreateResourceDto {
  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString()
  avatarUrl?: string;

  @IsOptional() @IsString() @MaxLength(100)
  discipline?: string;
}

export class UpdateResourceDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  name?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString()
  avatarUrl?: string;

  @IsOptional() @IsString() @MaxLength(100)
  discipline?: string;

  @IsOptional() @IsIn(RESOURCE_STATUSES)
  status?: ResourceStatus;
}

export class LinkResourceUserDto {
  @IsString()
  userId!: string;
}

export class ListResourcesQueryDto {
  @IsOptional() @IsString() @MinLength(1)
  search?: string;

  @IsOptional() @IsIn(RESOURCE_KINDS)
  kind?: ResourceKind;

  @IsOptional() @IsIn(RESOURCE_STATUSES)
  status?: ResourceStatus;

  // El query param llega como string; coacciona a número antes de validar
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number;

  @IsOptional() @IsString()
  cursor?: string;
}

export interface ResourceResponse {
  id: string;
  name: string;
  email: string | null;
  kind: ResourceKind;
  status: ResourceStatus;
  userId: string | null;
  avatarUrl: string | null;
  discipline: string | null;
  createdAt: string;
  updatedAt: string;
}
