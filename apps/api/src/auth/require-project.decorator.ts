import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PROJECT_KEY = 'requireProject';
export const RequireProject = (paramName = 'id') =>
  SetMetadata(REQUIRE_PROJECT_KEY, paramName);
