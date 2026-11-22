import { Controller, Get, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

@Controller('fixture')
class ProtectedController {
  @Get() @RequirePermissions('INVDOC:read') read() {}
  @Get('create') @RequirePermissions('INVDOC:read', 'INVDOC:create') create() {}
  @Get('confirm')
  @RequirePermissions('INVDOC:read', 'INVDOC:update')
  confirm() {}
  @Get('session') session() {}
}
function context(method: keyof ProtectedController, permissions?: string[]) {
  return {
    getHandler: () => ProtectedController.prototype[method],
    getClass: () => ProtectedController,
    switchToHttp: () => ({
      getRequest: () => ({ user: permissions ? { permissions } : undefined }),
    }),
  } as unknown as ExecutionContext;
}
const guard = new PermissionsGuard(new Reflector());
it('denies protected operations without an authenticated permission context', () => {
  expect(() => guard.canActivate(context('read'))).toThrow('permissions');
});
it.each(['create', 'confirm'] as const)(
  'requires read and the action together for %s',
  (method) => {
    const action = method === 'create' ? 'INVDOC:create' : 'INVDOC:update';
    expect(guard.canActivate(context(method, [action]))).toBe(false);
    expect(guard.canActivate(context(method, ['INVDOC:read']))).toBe(false);
    expect(guard.canActivate(context(method, ['INVDOC:read', action]))).toBe(
      true,
    );
  },
);
it('does not treat another module permission as an inventory permission', () => {
  expect(guard.canActivate(context('read', ['PURORD:read']))).toBe(false);
});
it('allows JWT-only endpoints to leave action authorization to their own policy', () => {
  expect(guard.canActivate(context('session', []))).toBe(true);
});
