import { useCallback, useEffect, useState } from 'react';
import { resourceService } from '../services/resourceService';
import type { ResourceResponse, CreateResourceDto, UpdateResourceDto } from '@project-workgroup/shared';

interface UseResourcesOptions {
  status?: 'active' | 'inactive';
  kind?: 'user' | 'placeholder';
  search?: string;
}

export function useResources(options: UseResourcesOptions = {}) {
  const { status, kind, search } = options;
  const [resources, setResources] = useState<ResourceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await resourceService.list({ status, kind, search, limit: 100 });
      setResources(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar recursos');
    } finally {
      setLoading(false);
    }
  }, [status, kind, search]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (dto: CreateResourceDto) => { await resourceService.create(dto); await refresh(); }, [refresh]);
  const update = useCallback(async (id: string, dto: UpdateResourceDto) => { await resourceService.update(id, dto); await refresh(); }, [refresh]);
  const linkUser = useCallback(async (id: string, userId: string) => { await resourceService.linkUser(id, userId); await refresh(); }, [refresh]);
  const remove = useCallback(async (id: string) => { await resourceService.remove(id); await refresh(); }, [refresh]);

  return { resources, loading, error, refresh, create, update, linkUser, remove };
}

export default useResources;
