import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { ENV_FILE_PATH } from '../config/env-file';
import { validateEnv } from '../config/env.schema';

// CLI에서만 사용한다. NestJS 런타임 연결은 AppModule이 구성한다.
// 생성 명령은 변경 전 스키마의 개발용 DB에, 실행 명령은 대상 DB에 연결한다.
loadEnv({ path: ENV_FILE_PATH, quiet: true });
const database = validateEnv(process.env).database;
const extension = __filename.endsWith('.ts') ? 'ts' : 'js';

export default new DataSource({
  type: 'postgres',
  host: database.host,
  port: database.port,
  username: database.username,
  password: database.password,
  database: database.name,
  schema: 'public',
  synchronize: false,
  migrationsRun: false,
  migrationsTableName: 'typeorm_migrations',
  entities: [resolve(__dirname, `../**/*.entity.${extension}`)],
  migrations: [resolve(__dirname, `./migrations/*.${extension}`)],
  ssl: database.ssl
    ? { rejectUnauthorized: database.sslRejectUnauthorized }
    : false,
});
