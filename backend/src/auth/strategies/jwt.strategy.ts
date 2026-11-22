/** Bearer JWT의 서명·만료·인증 주체를 검증한 뒤 현재 DB 사용자로 Context를 재구성한다. */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { UserContext } from '../types/user-context.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey: configService.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: unknown): Promise<UserContext> {
    if (typeof payload !== 'object' || payload === null)
      throw new UnauthorizedException('Invalid token claims');
    const claims = payload as Record<string, unknown>;
    if (
      typeof claims.companyId !== 'string' ||
      !claims.companyId.trim() ||
      claims.companyId.length > 30 ||
      typeof claims.sub !== 'string' ||
      !claims.sub.trim() ||
      claims.sub.length > 50 ||
      !Number.isInteger(claims.tokenVersion) ||
      (claims.tokenVersion as number) < 0 ||
      typeof claims.exp !== 'number' ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= Date.now() / 1000
    ) {
      throw new UnauthorizedException(
        '로그인 정보가 유효하지 않습니다. 다시 로그인해 주세요.',
      );
    }
    const userContext = await this.authService.buildUserContext(
      claims.companyId,
      claims.sub,
      claims.tokenVersion as number,
    );

    if (!userContext) {
      throw new UnauthorizedException(
        '로그인이 만료되었거나 비밀번호가 변경되었습니다. 다시 로그인해 주세요.',
      );
    }

    return userContext;
  }
}
