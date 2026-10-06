import { registerAs } from '@nestjs/config';
import { ENV_DEFAULTS } from './env.schema';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? ENV_DEFAULTS.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  name: process.env.DB_NAME,
  ssl: (process.env.DB_SSL ?? ENV_DEFAULTS.DB_SSL) === 'true',
  sslRejectUnauthorized:
    (process.env.DB_SSL_REJECT_UNAUTHORIZED ??
      ENV_DEFAULTS.DB_SSL_REJECT_UNAUTHORIZED) === 'true',
  synchronize:
    (process.env.DB_SYNCHRONIZE ?? ENV_DEFAULTS.DB_SYNCHRONIZE) === 'true',
  logging: (process.env.DB_LOGGING ?? ENV_DEFAULTS.DB_LOGGING) === 'true',
}));
