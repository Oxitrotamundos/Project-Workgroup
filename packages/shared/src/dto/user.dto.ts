import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export const GLOBAL_ROLES = ['admin', 'pm', 'member'] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export const USER_STATUSES = ['active', 'disabled'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export class SearchUsersQueryDto {
  @IsOptional() @IsString() @MinLength(1)
  search?: string;

  // El query param llega como string; coacciona a número antes de validar
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number;

  @IsOptional() @IsString()
  cursor?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  role: GlobalRole;
  status: UserStatus;
  avatarUrl: string | null;
}

export interface PagedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export class UpdateUserAdminDto {
  @IsOptional() @IsIn(GLOBAL_ROLES)
  role?: GlobalRole;

  @IsOptional() @IsIn(USER_STATUSES)
  status?: UserStatus;
}
