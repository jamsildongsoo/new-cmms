import { registerAs } from '@nestjs/config';
import { ENV_DEFAULTS } from './env.schema';

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET,
  accessExpiresIn:
    process.env.JWT_ACCESS_EXPIRES_IN ??
    process.env.JWT_EXPIRES_IN ??
    ENV_DEFAULTS.JWT_ACCESS_EXPIRES_IN,
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET,
  refreshExpiresIn:
    process.env.JWT_REFRESH_EXPIRES_IN ?? ENV_DEFAULTS.JWT_REFRESH_EXPIRES_IN,
}));
