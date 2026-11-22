import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { RolesModule } from '../identity/roles/roles.module';
import { UsersModule } from '../identity/users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoginHistory } from './entities/login-history.entity';
import { LoginHistoryService } from './login-history.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoginHistory]),
    PassportModule,
    UsersModule,
    RolesModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const expiresIn = configService.getOrThrow<string>(
          'jwt.accessExpiresIn',
        ) as NonNullable<JwtModuleOptions['signOptions']>['expiresIn'];

        return {
          secret: configService.getOrThrow<string>('jwt.accessSecret'),
          signOptions: {
            algorithm: 'HS256',
            expiresIn,
          },
        };
      },
    }),
  ],
  providers: [
    AuthService,
    LoginHistoryService,
    JwtStrategy,
    JwtAuthGuard,
    PermissionsGuard,
  ],
  controllers: [AuthController],
  exports: [JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
