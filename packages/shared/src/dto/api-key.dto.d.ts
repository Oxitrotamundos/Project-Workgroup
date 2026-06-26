export declare class CreateApiKeyDto {
    name: string;
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
