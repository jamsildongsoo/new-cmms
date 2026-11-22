import { validateEnv } from './env.schema';
import { resolve } from 'node:path';
import { BACKEND_ROOT } from './env-file';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
const config = {
  DB_HOST: 'localhost',
  DB_USER: 'test',
  DB_PASSWORD: 'test',
  DB_NAME: 'test',
  JWT_ACCESS_SECRET: 'test-secret',
};
it('requires only the current access token and local storage configuration', () => {
  const result = validateEnv(config);
  expect(result.FILE_STORAGE_DRIVER).toBe('local');
  expect(result).not.toHaveProperty('JWT_REFRESH_SECRET');
  expect(result).not.toHaveProperty('MINIO_ENDPOINT');
});
it('rejects obsolete storage modes and missing current access secrets', () => {
  expect(() =>
    validateEnv({ ...config, FILE_STORAGE_DRIVER: 'minio' }),
  ).toThrow('must be local');
  expect(() =>
    validateEnv({
      ...config,
      JWT_ACCESS_SECRET: undefined,
      JWT_SECRET: 'old-secret',
    }),
  ).toThrow('JWT_ACCESS_SECRET is required');
});
it('defaults to production with synchronization disabled', () => {
  const env = validateEnv(config);
  expect(env.NODE_ENV).toBe('production');
  expect(env.database.synchronize).toBe(false);
});
it.each(['true', 'false'])(
  'respects development DB_SYNCHRONIZE=%s',
  (value) => {
    expect(
      validateEnv({ ...config, NODE_ENV: 'development', DB_SYNCHRONIZE: value })
        .database.synchronize,
    ).toBe(value === 'true');
  },
);
it.each(['test', 'production'])('rejects synchronization in %s', (mode) => {
  expect(() =>
    validateEnv({ ...config, NODE_ENV: mode, DB_SYNCHRONIZE: 'true' }),
  ).toThrow('DB_SYNCHRONIZE must be false');
  expect(
    validateEnv({ ...config, NODE_ENV: mode, DB_SYNCHRONIZE: 'false' }).database
      .synchronize,
  ).toBe(false);
});

it.each([
  ['PORT', '0'],
  ['NODE_ENV', 'staging'],
  ['DB_SYNCHRONIZE', 'yes'],
  ['PORT', '70000'],
  ['DB_PORT', '65536'],
  ['FILE_MAX_SIZE_BYTES', '0'],
  ['FILE_MAX_FILES_PER_UPLOAD', '0'],
  ['FILE_MAX_UPLOAD_TOTAL_BYTES', '0'],
  ['FILE_MAX_FILES_PER_UPLOAD', '1.5'],
  ['FILE_MAX_SIZE_BYTES', '9007199254740992'],
  ['LOGIN_HISTORY_RETENTION_DAYS', '-1'],
  ['TRUST_PROXY_HOPS', '-1'],
  ['JWT_ACCESS_EXPIRES_IN', 'nonsense'],
  ['JWT_ACCESS_EXPIRES_IN', '0s'],
  ['JWT_ACCESS_EXPIRES_IN', '15'],
  ['JWT_ACCESS_EXPIRES_IN', '1ms'],
  ['CORS_ORIGINS', ','],
  ['CORS_ORIGINS', 'https://example.com/path'],
  ['CORS_ORIGINS', 'https://example.com/'],
  ['CORS_ORIGINS', '*'],
  ['API_PREFIX', '/api'],
  ['FILE_ALLOWED_MIME_TYPES', ','],
  ['FILE_ALLOWED_MIME_TYPES', 'text/plain,invalid'],
  ['PORT', ''],
])('rejects invalid %s before starting application services', (key, value) => {
  expect(() => validateEnv({ ...config, [key]: value })).toThrow(key);
});

it('enforces consistent file size limits and preserves explicit zero policies', () => {
  expect(() =>
    validateEnv({ ...config, FILE_MAX_UPLOAD_TOTAL_BYTES: '1' }),
  ).toThrow('FILE_MAX_UPLOAD_TOTAL_BYTES');
  const env = validateEnv({
    ...config,
    LOGIN_HISTORY_RETENTION_DAYS: '0',
    TRUST_PROXY_HOPS: '0',
  });
  expect(env.app.loginHistoryRetentionDays).toBe(0);
  expect(env.app.trustProxyHops).toBe(0);
  expect(validateEnv(config).jwt.accessExpiresIn).toBe('15m');
  expect(
    validateEnv({ ...config, JWT_ACCESS_EXPIRES_IN: '1.5h' }).jwt
      .accessExpiresIn,
  ).toBe('1.5h');
});

it('resolves relative uploads against the backend directory and preserves absolute Docker paths', () => {
  expect(validateEnv(config).storage.localRoot).toBe(
    resolve(BACKEND_ROOT, 'uploads'),
  );
  expect(
    validateEnv({ ...config, FILE_LOCAL_ROOT: '/app/uploads' }).storage
      .localRoot,
  ).toBe('/app/uploads');
});

it('uses the same normalized values through ConfigService without Docker or an env file', async () => {
  const previous = process.env;
  process.env = { ...config, DB_SSL: ' TRUE ', DB_LOGGING: 'TRUE' };
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        skipProcessEnv: true,
        validate: validateEnv,
      }),
    ],
  }).compile();
  try {
    const service = module.get(ConfigService);
    expect(process.env.DB_SSL).toBe(' TRUE ');
    expect(service.get('DB_SSL')).toBe(true);
    expect(service.get('database.ssl')).toBe(true);
    expect(service.get('database.logging')).toBe(true);
    expect(service.get('app.port')).toBe(3000);
    expect(service.get('storage.localRoot')).toBe(
      resolve(BACKEND_ROOT, 'uploads'),
    );
    expect(service.get('app.loginHistoryRetentionDays')).toBe(90);
  } finally {
    await module.close();
    process.env = previous;
  }
});
