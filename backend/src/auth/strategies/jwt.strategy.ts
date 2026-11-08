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
      typeof claims.exp !== 'number' ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= Date.now() / 1000
    ) {
      throw new UnauthorizedException('Invalid token claims');
    }
    const userContext = await this.authService.buildUserContext(
      claims.companyId,
      claims.sub,
    );

    if (!userContext) {
      throw new UnauthorizedException('Invalid token user');
    }

    return userContext;
  }
}
