import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateApiKeyDto {
  @IsString() @MinLength(1) @MaxLength(100)
  name!: string;

  @IsOptional() @IsDateString()
  expiresAt?: string;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyResponse extends ApiKeyResponse {
  plaintext: string;
}
