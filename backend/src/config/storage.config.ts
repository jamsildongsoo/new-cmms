/** backend/.env의 업로드 설정. 상대 경로는 backend 기준이며 Compose는 /app/uploads를 지정한다. */
import { resolve } from 'node:path';
import { BACKEND_ROOT } from './env-file';
import type { EnvironmentVariables } from './env.schema';

export const buildStorageConfig = (env: EnvironmentVariables) => ({
  driver: env.FILE_STORAGE_DRIVER,
  localRoot: resolve(BACKEND_ROOT, env.FILE_LOCAL_ROOT),
  maxSizeBytes: env.FILE_MAX_SIZE_BYTES,
  maxFilesPerUpload: env.FILE_MAX_FILES_PER_UPLOAD,
  maxUploadTotalBytes: env.FILE_MAX_UPLOAD_TOTAL_BYTES,
  allowedMimeTypes: env.FILE_ALLOWED_MIME_TYPES.split(',').map((mime) =>
    mime.trim(),
  ),
});
