/** backend/.env의 JWT_ACCESS_SECRET과 단위 포함 만료시간을 사용한다. 운영 비밀값은 개발과 분리한다. */
import type { EnvironmentVariables } from './env.schema';

export const buildJwtConfig = (env: EnvironmentVariables) => ({
  accessSecret: env.JWT_ACCESS_SECRET,
  accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
});
