import { registerAs } from '@nestjs/config';
import { ENV_DEFAULTS } from './env.schema';

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  accessExpiresIn:
    process.env.JWT_ACCESS_EXPIRES_IN ?? ENV_DEFAULTS.JWT_ACCESS_EXPIRES_IN,
}));
