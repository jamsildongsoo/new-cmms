/** Compose는 환경변수를 전달한다. Docker 밖의 직접 실행은 루트 .env를 읽는다. */
import { resolve } from 'node:path';

// src/config와 dist/config에서 모두 프로젝트 루트 .env를 가리킨다.
// Docker에는 파일을 복사하지 않고 Compose가 process.env를 전달한다.
export const BACKEND_ROOT = resolve(__dirname, '../..');
export const ENV_FILE_PATH = resolve(BACKEND_ROOT, '../.env');
