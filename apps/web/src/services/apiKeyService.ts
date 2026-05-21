import { apiClient } from '../lib/apiClient';
import type { ApiKeyResponse, CreateApiKeyResponse } from '@project-workgroup/shared';

export const apiKeyService = {
  list: () => apiClient.get<ApiKeyResponse[]>('/v1/me/api-keys'),
  create: (name: string, expiresAt?: string) =>
    apiClient.post<CreateApiKeyResponse>('/v1/me/api-keys', { name, expiresAt }),
  revoke: (id: string) => apiClient.delete(`/v1/me/api-keys/${id}`),
};
