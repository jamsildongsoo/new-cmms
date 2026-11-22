import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequirePermission } from './decorators/require-permissions.decorator';
import { LoginDto } from './dto/login.dto';
import { LoginHistoryQueryDto } from './dto/login-history-query.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { AuthService } from './auth.service';
import { LoginHistoryService } from './login-history.service';
import type { UserContext } from './types/user-context.type';
import { ModuleCode } from '../common/constants/modules';
import { PermissionAction } from '../common/constants/permissions';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginHistory: LoginHistoryService,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    // 직접 보낸 X-Forwarded-For 헤더는 신뢰하지 않는다.
    return this.authService.login(dto, {
      ipAddress: request.ip ?? request.socket.remoteAddress,
      userAgent: request.get('user-agent'),
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: UserContext): UserContext {
    return user;
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(ModuleCode.LOGHIST, PermissionAction.READ)
  @Get('login-history')
  history(
    @CurrentUser() user: UserContext,
    @Query() query: LoginHistoryQueryDto,
  ) {
    return this.loginHistory.list(user, query);
  }
}
