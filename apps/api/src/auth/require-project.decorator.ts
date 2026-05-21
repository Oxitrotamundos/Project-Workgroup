import { SetMetadata } from '@nestjs/common';
import type { ProjectRole } from '@project-workgroup/shared';

export const REQUIRE_PROJECT_KEY = 'requireProject';

export interface RequireProjectMetadata {
  paramName: string;
  minRole?: ProjectRole;
}

export const RequireProject = (
  paramName = 'id',
  options?: { minRole?: ProjectRole },
) =>
  SetMetadata(REQUIRE_PROJECT_KEY, {
    paramName,
    minRole: options?.minRole,
  } satisfies RequireProjectMetadata);
