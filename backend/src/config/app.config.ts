/** 실행 모드는 환경변수 NODE_ENV에서 읽는다. Docker 밖의 직접 실행은 루트 .env를 읽는다. */
import type { EnvironmentVariables } from './env.schema';

export const buildAppConfig = (env: EnvironmentVariables) => ({
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  apiPrefix: env.API_PREFIX,
  corsOrigins: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
  trustProxyHops: env.TRUST_PROXY_HOPS,
  loginHistoryRetentionDays: env.LOGIN_HISTORY_RETENTION_DAYS,
});
