/** 회사+사용자로 로그인하고 현재 소속·역할 권한을 읽는다. 클라이언트 권한과 토큰의 업무 속성을 신뢰하지 않는다. */
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'node:crypto';
import { compare } from 'bcrypt';
import { RolesService } from '../identity/roles/roles.service';
import { UsersService } from '../identity/users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/jwt-payload.type';
import { UserContext } from './types/user-context.type';
import { LoginHistoryService, LoginClientInfo } from './login-history.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
    private readonly loginHistory: LoginHistoryService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    loginDto: LoginDto,
    client: LoginClientInfo = {},
  ): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    user: UserContext;
    refreshToken: string;
  }> {
    const { companyId, userId, password } = this.validateLoginDto(loginDto);
    const user = await this.usersService.findActiveById(companyId, userId);

    if (!user) {
      await this.loginHistory.record(
        companyId,
        userId,
        false,
        'USER_NOT_ACTIVE',
        client,
      );
      throw new UnauthorizedException(
        '회사·사용자 ID 또는 비밀번호를 확인해 주세요.',
      );
    }

    const passwordMatches = await compare(password, user.passwordHash);
    if (!passwordMatches) {
      await this.loginHistory.record(
        companyId,
        userId,
        false,
        'INVALID_PASSWORD',
        client,
      );
      throw new UnauthorizedException(
        '회사·사용자 ID 또는 비밀번호를 확인해 주세요.',
      );
    }

    const userContext = await this.buildUserContext(
      companyId,
      userId,
      user.tokenVersion,
    );
    if (!userContext) {
      await this.loginHistory.record(
        companyId,
        userId,
        false,
        'USER_CHANGED',
        client,
      );
      throw new UnauthorizedException(
        '회사·사용자 ID 또는 비밀번호를 확인해 주세요.',
      );
    }

    const payload: JwtPayload = {
      sub: userContext.userId,
      companyId: userContext.companyId,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    await this.loginHistory.record(companyId, userId, true, null, client);
    return {
      accessToken,
      tokenType: 'Bearer',
      user: userContext,
      refreshToken: await this.issueRefreshToken(userContext, user.tokenVersion),
    };
  }

  private refreshSecret(): string {
    return createHmac(
      'sha256',
      this.configService.getOrThrow<string>('jwt.accessSecret'),
    )
      .update('new-cmms-refresh-v1')
      .digest('hex');
  }

  private issueRefreshToken(user: UserContext, tokenVersion: number) {
    return this.jwtService.signAsync(
      {
        sub: user.userId,
        companyId: user.companyId,
        tokenVersion,
        purpose: 'refresh',
        jti: randomUUID(),
      },
      { secret: this.refreshSecret(), expiresIn: '7d', algorithm: 'HS256' },
    );
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token missing');
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwtService.verifyAsync<Record<string, unknown>>(
        refreshToken,
        { secret: this.refreshSecret(), algorithms: ['HS256'] },
      );
    } catch {
      throw new UnauthorizedException('Refresh token expired');
    }
    if (
      payload.purpose !== 'refresh' ||
      typeof payload.companyId !== 'string' ||
      typeof payload.sub !== 'string' ||
      !Number.isInteger(payload.tokenVersion)
    ) throw new UnauthorizedException('Invalid refresh token');
    const user = await this.buildUserContext(
      payload.companyId,
      payload.sub,
      payload.tokenVersion as number,
    );
    if (!user) throw new UnauthorizedException('Session changed');
    const accessToken = await this.jwtService.signAsync({
      sub: user.userId,
      companyId: user.companyId,
      tokenVersion: payload.tokenVersion,
    });
    return {
      accessToken,
      tokenType: 'Bearer' as const,
      user,
      refreshToken: await this.issueRefreshToken(user, payload.tokenVersion as number),
    };
  }

  async buildUserContext(
    companyId: string,
    userId: string,
    expectedTokenVersion?: number,
  ): Promise<UserContext | null> {
    if (
      typeof companyId !== 'string' ||
      !companyId.trim() ||
      companyId.length > 30 ||
      typeof userId !== 'string' ||
      !userId.trim() ||
      userId.length > 50
    )
      return null;
    const user = await this.usersService.findActiveById(companyId, userId);
    if (
      !user ||
      (expectedTokenVersion !== undefined &&
        user.tokenVersion !== expectedTokenVersion)
    ) {
      return null;
    }

    const permissions = await this.rolesService.findAssignedPermissionIds(
      user.companyId,
      user.roleId,
    );

    return {
      companyId: user.companyId,
      userId: user.userId,
      roleId: user.roleId,
      siteId: user.siteId,
      deptId: user.deptId,
      accessScope: user.accessScope,
      permissions,
    };
  }

  private validateLoginDto(loginDto: LoginDto): {
    companyId: string;
    userId: string;
    password: string;
  } {
    if (
      typeof loginDto.companyId !== 'string' ||
      !loginDto.companyId.trim() ||
      loginDto.companyId.trim().length > 30 ||
      typeof loginDto.userId !== 'string' ||
      !loginDto.userId.trim() ||
      loginDto.userId.trim().length > 50 ||
      typeof loginDto.password !== 'string' ||
      !loginDto.password
    ) {
      throw new BadRequestException(
        '회사 ID, 사용자 ID와 비밀번호를 입력해 주세요.',
      );
    }

    return {
      companyId: loginDto.companyId.trim(),
      userId: loginDto.userId.trim(),
      password: loginDto.password,
    };
  }
}
