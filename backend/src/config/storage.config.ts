import { registerAs } from '@nestjs/config';
import { ENV_DEFAULTS } from './env.schema';

export const storageConfig = registerAs('storage', () => ({
  driver: process.env.FILE_STORAGE_DRIVER ?? ENV_DEFAULTS.FILE_STORAGE_DRIVER,
  localRoot: process.env.FILE_LOCAL_ROOT ?? ENV_DEFAULTS.FILE_LOCAL_ROOT,
  maxSizeBytes: Number(
    process.env.FILE_MAX_SIZE_BYTES ?? ENV_DEFAULTS.FILE_MAX_SIZE_BYTES,
  ),
  maxFilesPerUpload: Number(
    process.env.FILE_MAX_FILES_PER_UPLOAD ??
      ENV_DEFAULTS.FILE_MAX_FILES_PER_UPLOAD,
  ),
  maxUploadTotalBytes: Number(
    process.env.FILE_MAX_UPLOAD_TOTAL_BYTES ??
      ENV_DEFAULTS.FILE_MAX_UPLOAD_TOTAL_BYTES,
  ),
  allowedMimeTypes: (
    process.env.FILE_ALLOWED_MIME_TYPES ?? ENV_DEFAULTS.FILE_ALLOWED_MIME_TYPES
  )
    .split(',')
    .map((mimeType) => mimeType.trim())
    .filter(Boolean),
  minio: {
    endpoint: process.env.MINIO_ENDPOINT,
    region: process.env.MINIO_REGION ?? ENV_DEFAULTS.MINIO_REGION,
    bucket: process.env.MINIO_BUCKET,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    forcePathStyle:
      (process.env.MINIO_FORCE_PATH_STYLE ??
        ENV_DEFAULTS.MINIO_FORCE_PATH_STYLE) === 'true',
  },
}));
