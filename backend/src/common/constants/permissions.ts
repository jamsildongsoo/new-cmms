export const PermissionAction = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

export type PermissionAction =
  (typeof PermissionAction)[keyof typeof PermissionAction];

export const buildPermissionCode = (
  moduleKey: string,
  action: PermissionAction,
): string => `${moduleKey}:${action}`;
