import { resolve } from 'node:path';

// src/config와 dist/config에서 모두 backend/.env를 가리킨다.
// Docker에는 파일을 복사하지 않고 Compose가 process.env를 전달한다.
export const ENV_FILE_PATH = resolve(__dirname, '../../.env');
