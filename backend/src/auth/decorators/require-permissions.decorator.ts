import { SetMetadata } from '@nestjs/common';
import {
  buildPermissionCode,
  PermissionAction,
} from '../../common/constants/permissions';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

export const RequirePermission = (
  moduleKey: string,
  action: PermissionAction,
) => RequirePermissions(buildPermissionCode(moduleKey, action));
