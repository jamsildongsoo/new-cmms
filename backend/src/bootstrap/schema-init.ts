/** ./bootstrap.sh schema 또는 npm run bootstrap:schema로 빈 public만 설치한다. DB_SYNCHRONIZE=false와 무관하게 명시적 DDL을 실행하며 기존 객체가 있으면 중단한다. */
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource, EntityManager } from 'typeorm';
import { ENV_FILE_PATH } from '../config/env-file';
import { validateEnv } from '../config/env.schema';

async function assertEmptyPublic(manager: EntityManager) {
  // pg_catalog는 계정의 테이블 접근권한과 관계없이 기존 객체를 확인할 수 있다.
  const objects =
    (await manager.query(`SELECT c.relname FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')`)) as {
      relname: string;
    }[];
  if (objects.length)
    throw new Error(
      'public에 기존 테이블·뷰·시퀀스가 존재합니다. 설치를 중단합니다. 기존 DB 업데이트는 별도 변경 절차를 사용하십시오.',
    );
}
export async function initializeEmptySchema(db: DataSource) {
  await assertEmptyPublic(db.manager);
  // DDL 계획 산출은 읽기 전용이다. 여기서는 운영 스키마 자동 동기화를 켜지 않는다.
  const schema = await db.driver.createSchemaBuilder().log();
  await db.transaction(async (manager) => {
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('cmms:public-schema-install', 0))",
    );
    // 동시에 다른 설치가 먼저 완료된 경우에도 재설치하지 않는다.
    await assertEmptyPublic(manager);
    for (const query of schema.upQueries)
      await manager.query(query.query, query.parameters);
  });
}

async function main() {
  loadEnv({ path: ENV_FILE_PATH, quiet: true });
  const config = validateEnv(process.env).database;
  const extension = __filename.endsWith('.ts') ? 'ts' : 'js';
  const db = new DataSource({
    type: 'postgres',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.name,
    schema: 'public',
    synchronize: false,
    entities: [resolve(__dirname, `../**/*.entity.${extension}`)],
    ssl: config.ssl
      ? { rejectUnauthorized: config.sslRejectUnauthorized }
      : false,
  });
  await db.initialize();
  try {
    await initializeEmptySchema(db);
    console.log(
      '빈 public 스키마의 업무 테이블 설치 완료. 다음으로 bootstrap-admin을 실행하십시오.',
    );
  } finally {
    await db.destroy();
  }
}
if (require.main === module)
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
