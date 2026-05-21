import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type GlobalRole = 'admin' | 'pm' | 'member';
export const Roles = (...roles: GlobalRole[]) => SetMetadata(ROLES_KEY, roles);
