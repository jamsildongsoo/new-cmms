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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    user: UserContext;
  }> {
    const { companyId, userId, password } = this.validateLoginDto(loginDto);
    const user = await this.usersService.findActiveById(companyId, userId);

    if (!user) {
      throw new UnauthorizedException('Invalid company, user, or password');
    }

    const passwordMatches = await compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid company, user, or password');
    }

    const userContext = await this.buildUserContext(companyId, userId);
    if (!userContext) {
      throw new UnauthorizedException('Invalid company, user, or password');
    }

    const payload: JwtPayload = {
      sub: userContext.userId,
      companyId: userContext.companyId,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      user: userContext,
    };
  }

  async buildUserContext(
    companyId: string,
    userId: string,
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
    if (!user) {
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
    if (!loginDto.companyId || !loginDto.userId || !loginDto.password) {
      throw new BadRequestException(
        'companyId, userId, and password are required',
      );
    }

    return {
      companyId: loginDto.companyId,
      userId: loginDto.userId,
      password: loginDto.password,
    };
  }
}
