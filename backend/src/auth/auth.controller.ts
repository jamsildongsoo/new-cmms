import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
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
    private readonly configService: ConfigService,
  ) {}

  private cookiePath(): string {
    const prefix = this.configService.get<string>('app.apiPrefix') || 'api';
    return `/${prefix}/auth`;
  }

  private setRefreshCookie(request: Request, response: Response, token: string) {
    response.cookie('cmms.refreshToken', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: request.secure,
      path: this.cookiePath(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(request: Request, response: Response) {
    response.clearCookie('cmms.refreshToken', {
      httpOnly: true,
      sameSite: 'strict',
      secure: request.secure,
      path: this.cookiePath(),
    });
  }

  private refreshCookie(request: Request): string | undefined {
    const entry = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('cmms.refreshToken='));
    return entry?.slice('cmms.refreshToken='.length);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    // 직접 보낸 X-Forwarded-For 헤더는 신뢰하지 않는다.
    const session = await this.authService.login(dto, {
      ipAddress: request.ip ?? request.socket.remoteAddress,
      userAgent: request.get('user-agent'),
    });
    this.setRefreshCookie(request, response, session.refreshToken);
    const { refreshToken: _refreshToken, ...publicSession } = session;
    void _refreshToken;
    return publicSession;
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const session = await this.authService.refresh(this.refreshCookie(request));
      this.setRefreshCookie(request, response, session.refreshToken);
      const { refreshToken: _refreshToken, ...publicSession } = session;
      void _refreshToken;
      return publicSession;
    } catch (error) {
      this.clearRefreshCookie(request, response);
      throw error;
    }
  }

  @Post('logout')
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.clearRefreshCookie(request, response);
    return { message: 'Logged out' };
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
