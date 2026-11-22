/** 서버·초기 설정은 backend/.env를 공유하며 외부 process.env가 우선한다. 루트 .env는 Compose 전용. */
import { resolve } from 'node:path';

// src/config와 dist/config에서 모두 backend/.env를 가리킨다.
// Docker에는 파일을 복사하지 않고 Compose가 process.env를 전달한다.
export const BACKEND_ROOT = resolve(__dirname, '../..');
export const ENV_FILE_PATH = resolve(BACKEND_ROOT, '.env');
