import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { postgresTestDatabase } from '../../../test/support/pglite';
import { Equipment } from './entities/equipment.entity';
import { Site } from '../../organization/sites/entities/site.entity';
import { Department } from '../../organization/departments/entities/department.entity';
import { CodeItem } from '../../codes/code-items/entities/code-item.entity';
import { CodeItemsService } from '../../codes/code-items/code-items.service';
import { CodeValidationService } from '../../codes/code-validation.service';
import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { Attachment } from '../../attachments/entities/attachment.entity';
import { NumberingService } from '../../numbering/numbering.service';
import type { UserContext } from '../../auth/types/user-context.type';

jest.setTimeout(90000);
const entities = [Equipment, Site, Department, CodeItem, Attachment];
const user = { companyId: 'A', userId: 'admin' } as UserContext;
const input = {
  equipmentId: 'EQ1',
  siteId: 'S1',
  deptId: 'D1',
  name: '펌프',
  typeCode: 'PUMP',
};
let db: DataSource,
  service: EquipmentService,
  controller: EquipmentController,
  close: () => Promise<void>;
beforeAll(async () => {
  const fixture = await postgresTestDatabase(entities);
  db = fixture.dataSource;
  close = fixture.close;
  service = new EquipmentService(
    db.getRepository(Equipment),
    db.getRepository(Site),
    db.getRepository(Department),
    new CodeValidationService(new CodeItemsService(db.getRepository(CodeItem))),
  );
  controller = new EquipmentController(new NumberingService(db), service);
});
afterAll(async () => {
  if (close) await close();
});
beforeEach(async () => {
  for (const entity of entities) await db.getRepository(entity).clear();
  await db
    .getRepository(CodeItem)
    .save({
      companyId: 'A',
      codeId: 'EQUIP_TYPE',
      codeItemId: 'PUMP',
      name: '펌프',
      sortOrder: 1,
    });
});

it('matches editable varchar DTO limits to existing equipment columns', () => {
  const skipped = new Set(['companyId', 'createdBy', 'updatedBy', 'deleteYn']);
  for (const column of db.getMetadata(Equipment).columns) {
    if (column.type !== 'varchar' || skipped.has(column.propertyName)) continue;
    const size = Number(column.length);
    for (const dto of [CreateEquipmentDto, UpdateEquipmentDto]) {
      if (dto === UpdateEquipmentDto && column.propertyName === 'equipmentId')
        continue;
      const data = { ...input, [column.propertyName]: 'a'.repeat(size + 1) };
      const errors = validateSync(plainToInstance(dto, data));
      expect(
        errors.find((e) => e.property === column.propertyName)?.constraints
          ?.maxLength,
      ).toBeDefined();
      expect(
        validateSync(
          plainToInstance(dto, {
            ...data,
            [column.propertyName]: 'a'.repeat(size),
          }),
        ).find((e) => e.property === column.propertyName)?.constraints
          ?.maxLength,
      ).toBeUndefined();
    }
  }
});

it('paginates filtered company rows and searches literal wildcard characters', async () => {
  await db
    .getRepository(Equipment)
    .save(
      Array.from({ length: 23 }, (_, index) => ({
        ...input,
        companyId: 'A',
        equipmentId: `EQ${String(index).padStart(2, '0')}`,
        name: index === 0 ? String.raw`펌프 100%_값 \경로` : '일반 펌프',
        createdBy: 'admin',
      })),
    );
  await db
    .getRepository(Equipment)
    .save({
      ...input,
      equipmentId: 'FOREIGN',
      companyId: 'B',
      createdBy: 'admin',
    });
  await db
    .getRepository(Equipment)
    .update({ companyId: 'A', equipmentId: 'EQ22' }, { deleteYn: 'Y' });
  const first = await service.findAll(user, {
    page: 1,
    limit: 20,
    siteId: 'S1',
  });
  const second = await service.findAll(user, {
    page: 2,
    limit: 20,
    siteId: 'S1',
  });
  expect(first).toMatchObject({ total: 22, page: 1, limit: 20 });
  expect(first.items).toHaveLength(20);
  expect(second.items).toHaveLength(2);
  expect(second.items.every((e) => e.companyId === 'A')).toBe(true);
  for (const searchVal of ['%', '_', String.fromCharCode(92)]) {
    const result = await service.findAll(user, {
      searchType: 'name',
      searchVal,
    });
    expect(result.total).toBe(1);
    expect(result.items[0].equipmentId).toBe('EQ00');
  }
  expect((await service.findAll(user, { siteId: 'other' })).total).toBe(0);
});

it('binds an equipment attachment to the entered key and rejects a foreign company group', async () => {
  const attachmentId = randomUUID();
  await db
    .getRepository(Attachment)
    .save({
      companyId: 'A',
      attachmentId,
      refModule: 'EQUIP',
      refId: null,
      createdBy: 'admin',
    });
  const saved = await controller.create(user, { ...input, attachmentId });
  expect(saved.attachmentId).toBe(attachmentId);
  expect(
    (
      await db
        .getRepository(Attachment)
        .findOneByOrFail({ companyId: 'A', attachmentId })
    ).refId,
  ).toBe('EQ1');
  const foreignId = randomUUID();
  await db
    .getRepository(Attachment)
    .save({
      companyId: 'B',
      attachmentId: foreignId,
      refModule: 'EQUIP',
      refId: null,
      createdBy: 'admin',
    });
  await expect(
    controller.update(user, 'EQ1', { attachmentId: foreignId }),
  ).rejects.toThrow();
  expect((await service.findOne(user, 'EQ1')).attachmentId).toBe(attachmentId);
});
