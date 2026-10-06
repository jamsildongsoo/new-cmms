import { registerAs } from '@nestjs/config';
import { ENV_DEFAULTS } from './env.schema';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? ENV_DEFAULTS.NODE_ENV,
  port: Number(process.env.PORT ?? ENV_DEFAULTS.PORT),
  apiPrefix: process.env.API_PREFIX ?? ENV_DEFAULTS.API_PREFIX,
  corsOrigins: (process.env.CORS_ORIGINS ?? ENV_DEFAULTS.CORS_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
}));
