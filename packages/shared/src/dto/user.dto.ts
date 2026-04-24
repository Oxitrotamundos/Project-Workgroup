import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class SearchUsersQueryDto {
  @IsOptional() @IsString() @MinLength(1)
  search?: string;

  @IsOptional() @IsInt() @Min(1)
  limit?: number;

  @IsOptional() @IsString()
  cursor?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'pm' | 'member';
  avatarUrl: string | null;
}

export interface PagedResponse<T> {
  items: T[];
  nextCursor: string | null;
}
