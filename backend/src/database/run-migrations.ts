import dataSource from './data-source';

async function main() {
  await dataSource.initialize();
  try {
    const objects = (await dataSource.query(`
      SELECT c.relname
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
        AND c.relname <> 'typeorm_migrations'
    `)) as { relname: string }[];
    if (objects.length) {
      const history = (await dataSource.query(`
        SELECT to_regclass('public.typeorm_migrations') IS NOT NULL AS present
      `)) as { present: boolean }[];
      const applied = history[0]?.present
        ? ((await dataSource.query(
            'SELECT COUNT(*)::int AS count FROM public.typeorm_migrations',
          )) as { count: number }[])[0]?.count
        : 0;
      if (!applied)
        throw new Error(
          '업무 테이블은 있지만 migration 이력이 없습니다. 기존 DB의 기준 스키마를 확인한 후 이력을 등록하세요.',
        );
    }
    const migrations = await dataSource.runMigrations({ transaction: 'all' });
    console.log(`Applied migrations: ${migrations.length}`);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
