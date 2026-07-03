import { apiClient } from '../lib/apiClient';
import type {
  CreateResourceDto,
  UpdateResourceDto,
  ResourceResponse,
  PagedResponse,
} from '@project-workgroup/shared';

export interface ListResourcesParams {
  search?: string;
  kind?: 'user' | 'placeholder';
  status?: 'active' | 'inactive';
  cursor?: string;
  limit?: number;
}

export const resourceService = {
  list: (params: ListResourcesParams = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.kind) qs.set('kind', params.kind);
    if (params.status) qs.set('status', params.status);
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return apiClient.get<PagedResponse<ResourceResponse>>(`/v1/resources${q ? `?${q}` : ''}`);
  },
  create: (dto: CreateResourceDto) => apiClient.post<ResourceResponse>('/v1/resources', dto),
  update: (id: string, dto: UpdateResourceDto) => apiClient.patch<ResourceResponse>(`/v1/resources/${id}`, dto),
  linkUser: (id: string, userId: string) => apiClient.patch<ResourceResponse>(`/v1/resources/${id}/link-user`, { userId }),
  remove: (id: string) => apiClient.delete(`/v1/resources/${id}`),
};
