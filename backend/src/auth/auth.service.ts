/** 회사+사용자로 로그인하고 현재 소속·역할 권한을 읽는다. 클라이언트 권한과 토큰의 업무 속성을 신뢰하지 않는다. */
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
  ) {}

  async login(
    loginDto: LoginDto,
    client: LoginClientInfo = {},
  ): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    user: UserContext;
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
