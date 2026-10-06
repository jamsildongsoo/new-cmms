type EnvValue = string | undefined;

export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  API_PREFIX: string;
  CORS_ORIGINS: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_SSL: boolean;
  DB_SSL_REJECT_UNAUTHORIZED: boolean;
  DB_SYNCHRONIZE: boolean;
  DB_LOGGING: boolean;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  FILE_STORAGE_DRIVER: 'local' | 'minio';
  FILE_LOCAL_ROOT: string;
  FILE_MAX_SIZE_BYTES: number;
  FILE_MAX_FILES_PER_UPLOAD: number;
  FILE_MAX_UPLOAD_TOTAL_BYTES: number;
  FILE_ALLOWED_MIME_TYPES: string;
  MINIO_ENDPOINT?: string;
  MINIO_REGION?: string;
  MINIO_BUCKET?: string;
  MINIO_ACCESS_KEY?: string;
  MINIO_SECRET_KEY?: string;
  MINIO_FORCE_PATH_STYLE: boolean;
}

export const ENV_DEFAULTS = {
  NODE_ENV: 'development',
  PORT: '3000',
  API_PREFIX: 'api',
  CORS_ORIGINS: 'http://localhost:5173',
  DB_PORT: '5432',
  DB_SSL: 'false',
  DB_SSL_REJECT_UNAUTHORIZED: 'true',
  DB_SYNCHRONIZE: 'false',
  DB_LOGGING: 'false',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  FILE_STORAGE_DRIVER: 'local',
  FILE_LOCAL_ROOT: './uploads',
  FILE_MAX_SIZE_BYTES: '10485760',
  FILE_MAX_FILES_PER_UPLOAD: '10',
  FILE_MAX_UPLOAD_TOTAL_BYTES: '52428800',
  FILE_ALLOWED_MIME_TYPES:
    'image/jpeg,image/png,application/pdf,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/x-hwp,application/haansofthwp,application/vnd.hancom.hwp,application/vnd.hancom.hwpx,application/zip',
  MINIO_REGION: 'us-east-1',
  MINIO_FORCE_PATH_STYLE: 'true',
} as const;

export function validateEnv(
  config: Record<string, EnvValue>,
): EnvironmentVariables {
  const errors: string[] = [];

  const readString = (key: string, fallback?: string): string => {
    const value = config[key] ?? fallback;
    if (value === undefined || value.trim() === '') {
      errors.push(`${key} is required`);
      return '';
    }
    return value;
  };

  const readNumber = (key: string, fallback?: string): number => {
    const rawValue = readString(key, fallback);
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`${key} must be a non-negative integer`);
      return 0;
    }
    return value;
  };

  const readBoolean = (key: string, fallback: string): boolean => {
    const rawValue = readString(key, fallback).toLowerCase();
    if (rawValue === 'true') {
      return true;
    }
    if (rawValue === 'false') {
      return false;
    }
    errors.push(`${key} must be true or false`);
    return false;
  };

  const nodeEnv = readString('NODE_ENV', ENV_DEFAULTS.NODE_ENV);
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    errors.push('NODE_ENV must be development, test, or production');
  }

  const storageDriver = readString(
    'FILE_STORAGE_DRIVER',
    ENV_DEFAULTS.FILE_STORAGE_DRIVER,
  );
  if (!['local', 'minio'].includes(storageDriver)) {
    errors.push('FILE_STORAGE_DRIVER must be local or minio');
  }

  const validated = {
    NODE_ENV: nodeEnv as EnvironmentVariables['NODE_ENV'],
    PORT: readNumber('PORT', ENV_DEFAULTS.PORT),
    API_PREFIX: readString('API_PREFIX', ENV_DEFAULTS.API_PREFIX),
    CORS_ORIGINS: readString('CORS_ORIGINS', ENV_DEFAULTS.CORS_ORIGINS),
    DB_HOST: readString('DB_HOST'),
    DB_PORT: readNumber('DB_PORT', ENV_DEFAULTS.DB_PORT),
    DB_USER: readString('DB_USER'),
    DB_PASSWORD: readString('DB_PASSWORD'),
    DB_NAME: readString('DB_NAME'),
    DB_SSL: readBoolean('DB_SSL', ENV_DEFAULTS.DB_SSL),
    DB_SSL_REJECT_UNAUTHORIZED: readBoolean(
      'DB_SSL_REJECT_UNAUTHORIZED',
      ENV_DEFAULTS.DB_SSL_REJECT_UNAUTHORIZED,
    ),
    DB_SYNCHRONIZE: readBoolean('DB_SYNCHRONIZE', ENV_DEFAULTS.DB_SYNCHRONIZE),
    DB_LOGGING: readBoolean('DB_LOGGING', ENV_DEFAULTS.DB_LOGGING),
    JWT_ACCESS_SECRET: readString('JWT_ACCESS_SECRET', config.JWT_SECRET),
    JWT_ACCESS_EXPIRES_IN: readString(
      'JWT_ACCESS_EXPIRES_IN',
      config.JWT_EXPIRES_IN ?? ENV_DEFAULTS.JWT_ACCESS_EXPIRES_IN,
    ),
    JWT_REFRESH_SECRET: readString('JWT_REFRESH_SECRET', config.JWT_SECRET),
    JWT_REFRESH_EXPIRES_IN: readString(
      'JWT_REFRESH_EXPIRES_IN',
      ENV_DEFAULTS.JWT_REFRESH_EXPIRES_IN,
    ),
    FILE_STORAGE_DRIVER:
      storageDriver as EnvironmentVariables['FILE_STORAGE_DRIVER'],
    FILE_LOCAL_ROOT: readString(
      'FILE_LOCAL_ROOT',
      ENV_DEFAULTS.FILE_LOCAL_ROOT,
    ),
    FILE_MAX_SIZE_BYTES: readNumber(
      'FILE_MAX_SIZE_BYTES',
      ENV_DEFAULTS.FILE_MAX_SIZE_BYTES,
    ),
    FILE_MAX_FILES_PER_UPLOAD: readNumber(
      'FILE_MAX_FILES_PER_UPLOAD',
      ENV_DEFAULTS.FILE_MAX_FILES_PER_UPLOAD,
    ),
    FILE_MAX_UPLOAD_TOTAL_BYTES: readNumber(
      'FILE_MAX_UPLOAD_TOTAL_BYTES',
      ENV_DEFAULTS.FILE_MAX_UPLOAD_TOTAL_BYTES,
    ),
    FILE_ALLOWED_MIME_TYPES: readString(
      'FILE_ALLOWED_MIME_TYPES',
      ENV_DEFAULTS.FILE_ALLOWED_MIME_TYPES,
    ),
    MINIO_ENDPOINT: config.MINIO_ENDPOINT,
    MINIO_REGION: config.MINIO_REGION ?? ENV_DEFAULTS.MINIO_REGION,
    MINIO_BUCKET: config.MINIO_BUCKET,
    MINIO_ACCESS_KEY: config.MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY: config.MINIO_SECRET_KEY,
    MINIO_FORCE_PATH_STYLE: readBoolean(
      'MINIO_FORCE_PATH_STYLE',
      ENV_DEFAULTS.MINIO_FORCE_PATH_STYLE,
    ),
  };

  if (validated.NODE_ENV === 'production' && validated.DB_SYNCHRONIZE) {
    errors.push('DB_SYNCHRONIZE must be false in production');
  }

  if (
    validated.NODE_ENV === 'production' &&
    validated.JWT_ACCESS_SECRET === validated.JWT_REFRESH_SECRET
  ) {
    errors.push(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ in production',
    );
  }

  if (validated.FILE_STORAGE_DRIVER === 'minio') {
    for (const key of [
      'MINIO_ENDPOINT',
      'MINIO_BUCKET',
      'MINIO_ACCESS_KEY',
      'MINIO_SECRET_KEY',
    ]) {
      if (!config[key] || config[key]?.trim() === '') {
        errors.push(`${key} is required when FILE_STORAGE_DRIVER=minio`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors.map((error) => `- ${error}`).join('\n')}`,
    );
  }

  return validated;
}
