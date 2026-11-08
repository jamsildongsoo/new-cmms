import { Type } from '@nestjs/common';
import { MetadataScanner, Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from '../auth/decorators/require-permissions.decorator';
import { findModule } from '../common/constants/modules';
import { PermissionAction } from '../common/constants/permissions';

// Controller 선언이 지원 동작의 유일한 기준이다. rbac=true라고 없는 CRUD를 생성하지 않는다.
export function collectControllerPermissions(
  controllers: readonly Type<unknown>[],
): string[] {
  const reflector = new Reflector();
  const scanner = new MetadataScanner();
  const permissions = new Set<string>();
  for (const controller of controllers) {
    const prototype = controller.prototype as Record<string, (...args: unknown[]) => unknown>;
    for (const method of scanner.getAllMethodNames(prototype)) {
      const declared =
        reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
          prototype[method],
          controller,
        ]) ?? [];
      for (const permission of declared) {
        const [key, action, extra] = permission.split(':');
        const module = findModule(key);
        if (
          !module ||
          extra !== undefined ||
          !Object.values(PermissionAction).includes(action as PermissionAction)
        )
          throw new Error(`Invalid controller permission: ${permission}`);
        if (module.rbac) permissions.add(permission);
      }
    }
  }
  return [...permissions].sort();
}
