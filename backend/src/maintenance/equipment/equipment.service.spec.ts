import { Repository } from 'typeorm';
import { EquipmentService } from './equipment.service';
import { Equipment } from './entities/equipment.entity';
import { Site } from '../../organization/sites/entities/site.entity';
import { Department } from '../../organization/departments/entities/department.entity';
import { CodeValidationService } from '../../codes/code-validation.service';
import { UserContext } from '../../auth/types/user-context.type';

const actor = { companyId: 'A', userId: 'editor' } as UserContext;
function fixture() {
  const equipment = {
    companyId: 'A',
    equipmentId: 'EQ1',
    siteId: 'old-site',
    deptId: 'old-dept',
    name: '펌프',
    typeCode: 'PUMP',
    inspectionPeriod: 1,
    inspectionUnit: 'MONTH',
    inspectionDate: '20261001',
    nextInspectionDate: '20261101',
    attachmentId: 'files',
    deleteYn: 'N',
    createdBy: 'creator',
  } as Equipment;
  const types = {
    find: jest.fn(async () => [{ codeItemId: 'PUMP', name: '펌프' }]),
  };
  const repository = {
    findOneBy: jest.fn(async (query: Partial<Equipment>) =>
      query.parentEquipmentId ? null : (equipment as Equipment | null),
    ),
    find: jest.fn(async () => [equipment]),
    create: (value: Equipment) => value,
    save: jest.fn(async (value: Equipment) => value),
    manager: { getRepository: () => types },
  };
  const sites = {
    find: jest.fn(async () => [{ siteId: 'S1', name: '사업장' }]),
  };
  const departments = {
    find: jest.fn(async () => [{ deptId: 'D1', name: '부서' }]),
  };
  const codes = { assertValidItem: jest.fn(async () => undefined) };
  const service = new EquipmentService(
    repository as unknown as Repository<Equipment>,
    sites as unknown as Repository<Site>,
    departments as unknown as Repository<Department>,
    codes as unknown as CodeValidationService,
  );
  return { service, equipment, repository, sites, departments, types, codes };
}

describe('Equipment inspection fields', () => {
  it('creates optional dates and cycles as null and records the authenticated creator', async () => {
    const { service, repository } = fixture();
    repository.findOneBy.mockResolvedValueOnce(null);
    const saved = await service.create(actor, {
      equipmentId: 'EQ2',
      siteId: 'S1',
      deptId: 'D1',
      name: '설비',
      typeCode: 'PUMP',
    });
    expect(saved).toMatchObject({
      companyId: 'A',
      inspectionPeriod: null,
      inspectionUnit: null,
      inspectionDate: null,
      nextInspectionDate: null,
      deleteYn: 'N',
      createdBy: 'editor',
    });
    expect(saved).not.toHaveProperty('period');
    expect(saved).not.toHaveProperty('unit');
  });

  it('persists manually selected dates and preserves existing attachment and legal cycle', async () => {
    const { service, equipment, repository } = fixture();
    equipment.legalInspectionPeriod = 12;
    const saved = await service.update(actor, 'EQ1', {
      inspectionDate: '20261105',
      nextInspectionDate: '20261210',
    });
    expect(saved).toMatchObject({
      inspectionDate: '20261105',
      nextInspectionDate: '20261210',
      legalInspectionPeriod: 12,
      attachmentId: 'files',
      createdBy: 'creator',
      updatedBy: 'editor',
    });
    expect(repository.findOneBy).toHaveBeenCalledWith({
      companyId: 'A',
      equipmentId: 'EQ1',
      deleteYn: 'N',
    });
  });

  it.each(['20260229', '20261301', '20260431', '2026-11-05'])(
    'rejects invalid date %s without saving',
    async (date) => {
      const { service, repository } = fixture();
      await expect(
        service.update(actor, 'EQ1', { nextInspectionDate: date }),
      ).rejects.toThrow();
      expect(repository.save).not.toHaveBeenCalled();
    },
  );

  it('accepts a leap day and supports explicitly clearing dates', async () => {
    const { service } = fixture();
    expect(
      (
        await service.update(actor, 'EQ1', {
          inspectionDate: '20240229',
          nextInspectionDate: null,
        })
      ).inspectionDate,
    ).toBe('20240229');
    expect(
      (await service.update(actor, 'EQ1', { inspectionDate: null }))
        .inspectionDate,
    ).toBeNull();
  });

  it('clears the next date when the inspection cycle is removed', async () => {
    const { service } = fixture();
    expect(
      (await service.update(actor, 'EQ1', { inspectionPeriod: null }))
        .nextInspectionDate,
    ).toBeNull();
  });

  it('preserves historical organization and type references on unrelated edits', async () => {
    const { service, codes } = fixture();
    const saved = await service.update(actor, 'EQ1', {
      siteId: 'old-site',
      deptId: 'old-dept',
      typeCode: 'PUMP',
      note: '수정',
    });
    expect(saved.siteId).toBe('old-site');
    expect(saved.deptId).toBe('old-dept');
    expect(codes.assertValidItem).not.toHaveBeenCalled();
  });

  it('only provides choices belonging to the current company', async () => {
    const { service, sites, departments, types } = fixture();
    const choices = await service.getOptions(actor);
    expect(sites.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'A', deleteYn: 'N' } }),
    );
    expect(departments.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'A', deleteYn: 'N' } }),
    );
    expect(types.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'A', codeId: 'EQUIPMENT_TYPE' },
      }),
    );
    expect(choices.sites).toEqual([{ value: 'S1', label: '사업장' }]);
  });

  it('soft deletes with update audit fields and retains attachments', async () => {
    const { service } = fixture();
    expect(await service.remove(actor, 'EQ1')).toMatchObject({
      deleteYn: 'Y',
      updatedBy: 'editor',
      attachmentId: 'files',
    });
  });
});

describe('Equipment hierarchy', () => {
  it('rejects self and descendant parents', async () => {
    const { service, equipment, repository } = fixture();
    await expect(
      service.update(actor, 'EQ1', { parentEquipmentId: 'EQ1' }),
    ).rejects.toThrow();
    repository.find.mockResolvedValueOnce([
      equipment,
      { ...equipment, equipmentId: 'CHILD', parentEquipmentId: 'EQ1' },
    ]);
    await expect(
      service.update(actor, 'EQ1', { parentEquipmentId: 'CHILD' }),
    ).rejects.toThrow();
    expect(repository.save).not.toHaveBeenCalled();
  });
  it('accepts a same-site parent and rejects a missing or other-site parent', async () => {
    const { service, equipment, repository } = fixture();
    const parent = { ...equipment, equipmentId: 'PARENT' };
    repository.find.mockResolvedValueOnce([equipment, parent]);
    expect(
      (
        await service.update(actor, 'EQ1', {
          parentEquipmentId: 'PARENT',
          pmTargetYn: 'Y',
          legalInspectionDate: '20261106',
        })
      ).parentEquipmentId,
    ).toBe('PARENT');
    repository.find.mockResolvedValueOnce([
      equipment,
      { ...parent, siteId: 'OTHER' },
    ]);
    await expect(
      service.update(actor, 'EQ1', { parentEquipmentId: 'PARENT' }),
    ).rejects.toThrow();
    repository.find.mockResolvedValueOnce([equipment]);
    await expect(
      service.update(actor, 'EQ1', { parentEquipmentId: 'MISSING' }),
    ).rejects.toThrow();
    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'A', deleteYn: 'N' } }),
    );
  });
  it('blocks deletion and site moves when active children remain', async () => {
    const { service, equipment, repository } = fixture();
    repository.findOneBy.mockImplementation(async () => equipment);
    await expect(service.remove(actor, 'EQ1')).rejects.toThrow();
    await expect(
      service.update(actor, 'EQ1', { siteId: 'NEW' }),
    ).rejects.toThrow();
    expect(repository.save).not.toHaveBeenCalled();
  });
  it('returns a company and site scoped tree without pagination', async () => {
    const { service, repository } = fixture();
    await service.tree(actor, 'S1');
    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'A', deleteYn: 'N', siteId: 'S1' },
      }),
    );
  });
});
