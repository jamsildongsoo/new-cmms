import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UserContext } from '../types/user-context.type';

interface RequestWithUserContext extends Request {
  user?: UserContext;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserContext | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithUserContext>();
    return request.user;
  },
);
