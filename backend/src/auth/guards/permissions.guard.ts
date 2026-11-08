/** Controller의 요구 권한과 서버 UserContext를 비교한다. 권한 선언이 없는 경로의 업무 조건은 Service가 검사한다. */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { UserContext } from '../types/user-context.type';

interface AuthenticatedRequest extends Request {
  user?: UserContext;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userPermissions = request.user?.permissions;

    if (!userPermissions) {
      throw new ForbiddenException('User permissions are not available');
    }

    return requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
  }
}
