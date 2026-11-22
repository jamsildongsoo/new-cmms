import { DataSource } from 'typeorm';
import { postgresTestDatabase } from '../../../test/support/pglite';
import type { UserContext } from '../../auth/types/user-context.type';
import { CodeValidationService } from '../code-validation.service';
import { CodeItemsService } from './code-items.service';
import { CodeItem } from './entities/code-item.entity';
jest.setTimeout(90000);
const user = (companyId: string) =>
  ({ companyId, userId: 'same-user' }) as UserContext;
let db: DataSource, service: CodeItemsService, close: () => Promise<void>;
beforeAll(async () => {
  const fixture = await postgresTestDatabase([CodeItem]);
  db = fixture.dataSource;
  close = fixture.close;
  service = new CodeItemsService(db.getRepository(CodeItem));
});
afterAll(async () => {
  if (close) await close();
});
beforeEach(async () => {
  await db.getRepository(CodeItem).clear();
});
it('uses company/code/item as a composite key and isolates updates and deletes of identical codes', async () => {
  const payload = {
    codeId: 'MATL_TYPE',
    codeItemId: 'PART',
    name: 'A 부품',
  };
  await service.create(user('A'), payload);
  await service.create(user('B'), { ...payload, name: 'B 예비품' });
  expect(
    (await service.findByCode(user('A'), 'MATL_TYPE')).map((r) => r.name),
  ).toEqual(['A 부품']);
  await service.update(user('A'), 'MATL_TYPE', 'PART', { name: 'A 수정' });
  expect((await service.findOne(user('B'), 'MATL_TYPE', 'PART')).name).toBe(
    'B 예비품',
  );
  await service.remove(user('A'), 'MATL_TYPE', 'PART');
  expect(await service.findByCode(user('A'), 'MATL_TYPE')).toEqual([]);
  expect(await service.findByCode(user('B'), 'MATL_TYPE')).toHaveLength(1);
});
it('never falls back to another company during business-code validation', async () => {
  await service.create(user('B'), {
    codeId: 'MATL_TYPE',
    codeItemId: 'PART',
    name: 'B only',
  });
  const validation = new CodeValidationService(service);
  await expect(
    validation.assertValidItem({
      companyId: 'A',
      codeId: 'MATL_TYPE',
      codeItemId: 'PART',
    }),
  ).rejects.toThrow('not found');
  await expect(
    validation.assertValidItem({
      companyId: 'B',
      codeId: 'MATL_TYPE',
      codeItemId: 'PART',
    }),
  ).resolves.toBeUndefined();
});
it('rejects duplicate items within one company and unregistered code groups', async () => {
  const item = { codeId: 'MATL_TYPE', codeItemId: 'PART', name: '부품' };
  await service.create(user('A'), item);
  await expect(service.create(user('A'), item)).rejects.toThrow(
    'already exists',
  );
  await expect(
    service.create(user('A'), { ...item, codeId: 'UNKNOWN' }),
  ).rejects.toThrow('Code not found');
});
