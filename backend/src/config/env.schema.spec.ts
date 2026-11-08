import { validateEnv } from './env.schema';
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
it('forbids implicit schema synchronization in production', () => {
  expect(() =>
    validateEnv({ ...config, NODE_ENV: 'production', DB_SYNCHRONIZE: 'true' }),
  ).toThrow('DB_SYNCHRONIZE must be false');
});
