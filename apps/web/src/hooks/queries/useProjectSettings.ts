import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProjectService } from '../../services/projectService';
import type {
  ProjectSettingsResponse,
  UpdateProjectSettingsDto,
} from '@project-workgroup/shared';

export const projectSettingsKey = (projectId: string | undefined) =>
  ['project-settings', projectId ?? '_'] as const;

export function useProjectSettingsQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: projectSettingsKey(projectId),
    queryFn: () => {
      if (!projectId) return Promise.resolve(null as ProjectSettingsResponse | null);
      return ProjectService.getSettings(projectId);
    },
    enabled: Boolean(projectId),
  });
}

export function useUpdateProjectSettingsMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = projectSettingsKey(projectId);
  return useMutation({
    mutationFn: (dto: UpdateProjectSettingsDto) => {
      if (!projectId) throw new Error('projectId is required');
      return ProjectService.updateSettings(projectId, dto);
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData<ProjectSettingsResponse>(queryKey, fresh);
    },
  });
}
