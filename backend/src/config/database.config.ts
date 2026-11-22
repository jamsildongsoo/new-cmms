/** 개발 DB만 DB_SYNCHRONIZE=true 허용. 운영 스키마 설치는 bootstrap.sh schema로 별도 실행한다. */
import type { EnvironmentVariables } from './env.schema';

export const buildDatabaseConfig = (env: EnvironmentVariables) => ({
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  name: env.DB_NAME,
  ssl: env.DB_SSL,
  sslRejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
  synchronize: env.DB_SYNCHRONIZE,
  logging: env.DB_LOGGING,
});
