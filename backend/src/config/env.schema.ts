/** NODE_ENV: 개발 development / 배포 production(test는 자동 검사 전용). DB_SYNCHRONIZE는 명시적 true/false이며 기본 false. */
import { buildAppConfig } from './app.config';
import { buildDatabaseConfig } from './database.config';
import { buildJwtConfig } from './jwt.config';
import { buildStorageConfig } from './storage.config';

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
  DB_LOGGING: boolean;
  DB_SYNCHRONIZE: boolean;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  LOGIN_HISTORY_RETENTION_DAYS: number;
  TRUST_PROXY_HOPS: number;
  FILE_STORAGE_DRIVER: 'local';
  FILE_LOCAL_ROOT: string;
  FILE_MAX_SIZE_BYTES: number;
  FILE_MAX_FILES_PER_UPLOAD: number;
  FILE_MAX_UPLOAD_TOTAL_BYTES: number;
  FILE_ALLOWED_MIME_TYPES: string;
}

export const ENV_DEFAULTS = {
  NODE_ENV: 'production',
  PORT: '3000',
  API_PREFIX: 'api',
  CORS_ORIGINS: 'http://localhost:5173',
  DB_PORT: '5432',
  DB_SSL: 'false',
  DB_SSL_REJECT_UNAUTHORIZED: 'true',
  DB_LOGGING: 'false',
  DB_SYNCHRONIZE: 'false',
  JWT_ACCESS_EXPIRES_IN: '15m',
  LOGIN_HISTORY_RETENTION_DAYS: '90',
  TRUST_PROXY_HOPS: '0',
  FILE_STORAGE_DRIVER: 'local',
  FILE_LOCAL_ROOT: './uploads',
  FILE_MAX_SIZE_BYTES: '10485760',
  FILE_MAX_FILES_PER_UPLOAD: '10',
  FILE_MAX_UPLOAD_TOTAL_BYTES: '52428800',
  FILE_ALLOWED_MIME_TYPES:
    'image/jpeg,image/png,application/pdf,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/x-hwp,application/haansofthwp,application/vnd.hancom.hwp,application/vnd.hancom.hwpx,application/zip',
} as const;

export function validateEnv(config: Record<string, EnvValue>) {
  const errors: string[] = [];

  const readString = (key: string, fallback?: string): string => {
    const value = config[key] ?? fallback;
    if (value === undefined || value.trim() === '') {
      errors.push(`${key} is required`);
      return '';
    }
    return value;
  };

  const readNumber = (
    key: string,
    fallback?: string,
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
  ): number => {
    const rawValue = readString(key, fallback);
    const value = Number(rawValue);
    if (
      !/^\d+$/.test(rawValue) ||
      !Number.isSafeInteger(value) ||
      value < min ||
      value > max
    ) {
      errors.push(`${key} must be an integer between ${min} and ${max}`);
      return 0;
    }
    return value;
  };

  const readBoolean = (key: string, fallback: string): boolean => {
    const rawValue = readString(key, fallback).trim().toLowerCase();
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
  if (storageDriver !== 'local') {
    errors.push('FILE_STORAGE_DRIVER must be local');
  }

  const validated = {
    NODE_ENV: nodeEnv as EnvironmentVariables['NODE_ENV'],
    PORT: readNumber('PORT', ENV_DEFAULTS.PORT, 1, 65535),
    API_PREFIX: readString('API_PREFIX', ENV_DEFAULTS.API_PREFIX),
    CORS_ORIGINS: readString('CORS_ORIGINS', ENV_DEFAULTS.CORS_ORIGINS),
    DB_HOST: readString('DB_HOST'),
    DB_PORT: readNumber('DB_PORT', ENV_DEFAULTS.DB_PORT, 1, 65535),
    DB_USER: readString('DB_USER'),
    DB_PASSWORD: readString('DB_PASSWORD'),
    DB_NAME: readString('DB_NAME'),
    DB_SSL: readBoolean('DB_SSL', ENV_DEFAULTS.DB_SSL),
    DB_SSL_REJECT_UNAUTHORIZED: readBoolean(
      'DB_SSL_REJECT_UNAUTHORIZED',
      ENV_DEFAULTS.DB_SSL_REJECT_UNAUTHORIZED,
    ),
    DB_LOGGING: readBoolean('DB_LOGGING', ENV_DEFAULTS.DB_LOGGING),
    DB_SYNCHRONIZE: readBoolean('DB_SYNCHRONIZE', ENV_DEFAULTS.DB_SYNCHRONIZE),
    JWT_ACCESS_SECRET: readString('JWT_ACCESS_SECRET'),
    LOGIN_HISTORY_RETENTION_DAYS: readNumber(
      'LOGIN_HISTORY_RETENTION_DAYS',
      ENV_DEFAULTS.LOGIN_HISTORY_RETENTION_DAYS,
    ),
    TRUST_PROXY_HOPS: readNumber(
      'TRUST_PROXY_HOPS',
      ENV_DEFAULTS.TRUST_PROXY_HOPS,
    ),
    JWT_ACCESS_EXPIRES_IN: readString(
      'JWT_ACCESS_EXPIRES_IN',
      ENV_DEFAULTS.JWT_ACCESS_EXPIRES_IN,
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
      1,
    ),
    FILE_MAX_FILES_PER_UPLOAD: readNumber(
      'FILE_MAX_FILES_PER_UPLOAD',
      ENV_DEFAULTS.FILE_MAX_FILES_PER_UPLOAD,
      1,
    ),
    FILE_MAX_UPLOAD_TOTAL_BYTES: readNumber(
      'FILE_MAX_UPLOAD_TOTAL_BYTES',
      ENV_DEFAULTS.FILE_MAX_UPLOAD_TOTAL_BYTES,
      1,
    ),
    FILE_ALLOWED_MIME_TYPES: readString(
      'FILE_ALLOWED_MIME_TYPES',
      ENV_DEFAULTS.FILE_ALLOWED_MIME_TYPES,
    ),
  };

  if (validated.NODE_ENV !== 'development' && validated.DB_SYNCHRONIZE) {
    errors.push('DB_SYNCHRONIZE must be false outside development');
  }

  const origins = validated.CORS_ORIGINS.split(',').map((origin) =>
    origin.trim(),
  );
  if (
    !origins.length ||
    origins.some((origin) => {
      try {
        const url = new URL(origin);
        return (
          !['http:', 'https:'].includes(url.protocol) || url.origin !== origin
        );
      } catch {
        return true;
      }
    })
  )
    errors.push(
      'CORS_ORIGINS must contain comma-separated HTTP(S) origins without paths or trailing slashes',
    );
  validated.CORS_ORIGINS = origins.join(',');

  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(validated.API_PREFIX)) {
    errors.push(
      'API_PREFIX must be a relative path without leading or trailing slashes',
    );
  }

  // JWT strings require explicit units; a bare number is interpreted as milliseconds by the signer.
  const duration = /^(\d+(?:\.\d+)?)(ms|s|m|h|d|w|y)$/.exec(
    validated.JWT_ACCESS_EXPIRES_IN,
  );
  const units: Record<string, number> = {
    ms: 0.001,
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
    y: 31557600,
  };
  const seconds = duration ? Number(duration[1]) * units[duration[2]] : NaN;
  if (
    !Number.isFinite(seconds) ||
    seconds < 1 ||
    seconds > Number.MAX_SAFE_INTEGER - Date.now() / 1000
  ) {
    errors.push(
      'JWT_ACCESS_EXPIRES_IN must be a positive duration of at least 1 second with a unit (ms, s, m, h, d, w, y), e.g. 15m',
    );
  }

  const mimeTypes = validated.FILE_ALLOWED_MIME_TYPES.split(',').map((mime) =>
    mime.trim(),
  );
  if (
    mimeTypes.some(
      (mime) => !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(mime),
    )
  ) {
    errors.push(
      'FILE_ALLOWED_MIME_TYPES must contain comma-separated MIME types',
    );
  }
  validated.FILE_ALLOWED_MIME_TYPES = mimeTypes.join(',');
  if (validated.FILE_MAX_UPLOAD_TOTAL_BYTES < validated.FILE_MAX_SIZE_BYTES) {
    errors.push(
      'FILE_MAX_UPLOAD_TOTAL_BYTES must be at least FILE_MAX_SIZE_BYTES',
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors.map((error) => `- ${error}`).join('\n')}`,
    );
  }

  return {
    ...validated,
    app: buildAppConfig(validated),
    database: buildDatabaseConfig(validated),
    jwt: buildJwtConfig(validated),
    storage: buildStorageConfig(validated),
  };
}
