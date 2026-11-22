import { globSync } from 'node:fs';
import { resolve } from 'node:path';
import { postgresTestDatabase } from '../../test/support/pglite';
import { StockBalance } from '../inventory/stock/entities/stock-balance.entity';
import { initializeEmptySchema } from './schema-init';

jest.setTimeout(30000);
it('installs tables only in an empty public schema and refuses reinstallation without changing data', async () => {
  const fixture = await postgresTestDatabase([StockBalance]);
  try {
    const db = fixture.dataSource;
    await db.query('DROP TABLE public.stock_balance');
    await initializeEmptySchema(db);
    const repo = db.getRepository(StockBalance);
    await repo.save({
      companyId: 'A',
      siteId: 'S',
      warehouseId: 'W',
      materialId: 'M',
      quantity: '1',
      amount: '10',
    });
    await expect(initializeEmptySchema(db)).rejects.toThrow('설치를 중단');
    expect(await repo.count()).toBe(1);
    expect((await repo.find())[0].amount).toBe('10');
  } finally {
    await fixture.close();
  }
});

it('creates the full application schema without starting business services and rejects unrelated existing tables', async () => {
  const entities = globSync('src/**/*.entity.ts', {
    cwd: process.cwd(),
  }).flatMap((file) => Object.values(require(resolve(file))) as never[]);
  const fixture = await postgresTestDatabase(entities);
  try {
    const db = fixture.dataSource;
    // 이 테스트의 메모리 DB만 비운다. 실제 DB 접속정보는 사용하지 않는다.
    await db.dropDatabase();
    await initializeEmptySchema(db);
    const tables = (await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public'",
    )) as { tablename: string }[];
    expect(tables.map((row) => row.tablename)).toEqual(
      expect.arrayContaining([
        'company',
        'user',
        'role_permission',
        'inventory_document',
        'stock_balance',
        'inventory_period_lock',
      ]),
    );
    expect(tables.map((row) => row.tablename)).not.toContain('stock_valuation');
    await db.dropDatabase();
    await db.query('CREATE TABLE public.external_table (id integer)');
    await expect(initializeEmptySchema(db)).rejects.toThrow('설치를 중단');
    expect(
      await db.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public'",
      ),
    ).toEqual([{ tablename: 'external_table' }]);
  } finally {
    await fixture.close();
  }
});
