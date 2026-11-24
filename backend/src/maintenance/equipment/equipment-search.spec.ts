import { postgresTestDatabase } from '../../../test/support/pglite';
import type { UserContext } from '../../auth/types/user-context.type';
import { CodeItem } from '../../codes/code-items/entities/code-item.entity';
import { CodeValidationService } from '../../codes/code-validation.service';
import { CodeGroup } from '../../common/constants/code';
import { Department } from '../../organization/departments/entities/department.entity';
import { Site } from '../../organization/sites/entities/site.entity';
import { Equipment } from './entities/equipment.entity';
import { EquipmentService } from './equipment.service';

it('searches equipment type labels and limits OWN_SITE results to the assigned site', async () => {
  const { dataSource, close } = await postgresTestDatabase([
    Equipment, Site, Department, CodeItem,
  ]);
  try {
    const service = new EquipmentService(
      dataSource.getRepository(Equipment),
      dataSource.getRepository(Site),
      dataSource.getRepository(Department),
      {} as CodeValidationService,
    );
    await dataSource.getRepository(CodeItem).save({
      companyId: 'A', codeId: CodeGroup.EQUIP_TYPE,
      codeItemId: 'PUMP', name: '펌프',
    });
    for (const [siteId, equipmentId] of [['S1', 'EQ1'], ['S2', 'EQ2']]) {
      await dataSource.getRepository(Site).save({
        companyId: 'A', siteId, name: siteId, createdBy: 'admin',
      });
      await dataSource.getRepository(Equipment).save({
        companyId: 'A', siteId, equipmentId, name: equipmentId,
        typeCode: 'PUMP', deptId: 'D1', createdBy: 'admin',
      });
    }
    const companyUser = {
      companyId: 'A', userId: 'admin', accessScope: 'COMPANY_ALL',
    } as UserContext;
    const scopedUser = {
      ...companyUser, accessScope: 'OWN_SITE', siteId: 'S1',
    } as UserContext;
    expect((await service.findAll(companyUser, {
      page: 1, searchType: 'typeCode', searchVal: '펌프',
    })).total).toBe(2);
    const scoped = await service.findAll(scopedUser, { page: 1 });
    expect(scoped.items.map((item) => item.equipmentId)).toEqual(['EQ1']);
    expect((await service.findAll(scopedUser, { page: 1, siteId: 'S2' })).total).toBe(0);
    expect((await service.getOptions(scopedUser)).sites).toEqual([
      { value: 'S1', label: 'S1' },
    ]);
  } finally {
    await close();
  }
});
