import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export type RoleName = 'ADMIN' | 'ACCOUNTANT' | 'EMPLOYEE';

export const RequireRoles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
