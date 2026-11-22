import { SetMetadata } from '@nestjs/common';
import type { ModuleCode } from '../../common/constants/modules';
import {
  buildPermissionCode,
  PermissionAction,
} from '../../common/constants/permissions';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

export const RequirePermission = (
  moduleCode: ModuleCode,
  action: PermissionAction,
) => RequirePermissions(buildPermissionCode(moduleCode, action));
