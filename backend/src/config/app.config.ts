/** 실행 모드는 backend/.env의 NODE_ENV에서 읽는다(외부 환경변수 우선). npm 명령은 watch·디버그·빌드 코드 실행 방식만 선택한다. */
import type { EnvironmentVariables } from './env.schema';

export const buildAppConfig = (env: EnvironmentVariables) => ({
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  apiPrefix: env.API_PREFIX,
  corsOrigins: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
  trustProxyHops: env.TRUST_PROXY_HOPS,
  loginHistoryRetentionDays: env.LOGIN_HISTORY_RETENTION_DAYS,
});
