import { Repository } from 'typeorm';
import { DirectoryService } from './directory.service';
import { User } from '../../identity/users/entities/user.entity';
import { Department } from '../../organization/departments/entities/department.entity';
import { Equipment } from '../../maintenance/equipment/entities/equipment.entity';
import { Material } from '../../inventory/material/entities/material.entity';

function queryBuilder<T>(items: T[]) {
  const conditions: Array<[string, Record<string, unknown>]> = [];
  const builder = {
    select: jest.fn(() => builder),
    where: jest.fn((sql: string, params: Record<string, unknown>) => {
      conditions.push([sql, params]);
      return builder;
    }),
    andWhere: jest.fn((sql: string, params: Record<string, unknown> = {}) => {
      conditions.push([sql, params]);
      return builder;
    }),
    orderBy: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    getMany: jest.fn(async () => items),
  };
  return { builder, conditions };
}

describe('DirectoryService', () => {
  it('finds same-company user candidates and resolves department names in one batch', async () => {
    const users = queryBuilder([
      { userId: 'kim1', name: '김민수', deptId: 'D1', title: '팀장', position: null },
      { userId: 'kim2', name: '김민수', deptId: 'D2', title: null, position: '대리' },
    ]);
    const userRepo = { createQueryBuilder: jest.fn(() => users.builder) };
    const departmentRepo = {
      findBy: jest.fn(async () => [
        { deptId: 'D1', name: '설비팀' },
        { deptId: 'D2', name: '생산팀' },
      ]),
    };
    const service = new DirectoryService(
      userRepo as unknown as Repository<User>,
      departmentRepo as unknown as Repository<Department>,
      {} as Repository<Equipment>,
      {} as Repository<Material>,
    );

    const result = await service.searchUsers('COMPANY', ' 김민 ');

    expect(users.conditions).toContainEqual(['u.companyId = :companyId', { companyId: 'COMPANY' }]);
    expect(users.conditions.map(([sql]) => sql)).toContain("u.deleteYn = 'N'");
    expect(users.builder.limit).toHaveBeenCalledWith(10);
    expect(departmentRepo.findBy).toHaveBeenCalledTimes(1);
    expect(departmentRepo.findBy).toHaveBeenCalledWith(expect.objectContaining({ companyId: 'COMPANY', deleteYn: 'N' }));
    expect(result).toEqual([
      { userId: 'kim1', userName: '김민수', deptId: 'D1', deptName: '설비팀', title: '팀장', position: null },
      { userId: 'kim2', userName: '김민수', deptId: 'D2', deptName: '생산팀', title: null, position: '대리' },
    ]);
  });

  it('finds department candidates by name or ID within the company', async () => {
    const departments = queryBuilder([{ deptId: 'D1', name: '설비팀' }]);
    const service = new DirectoryService(
      {} as Repository<User>,
      { createQueryBuilder: () => departments.builder } as unknown as Repository<Department>,
      {} as Repository<Equipment>,
      {} as Repository<Material>,
    );

    expect(await service.searchDepartments('COMPANY', '설비')).toEqual([
      { deptId: 'D1', deptName: '설비팀' },
    ]);
    expect(departments.conditions).toContainEqual(['d.companyId = :companyId', { companyId: 'COMPANY' }]);
    expect(departments.conditions.map(([sql]) => sql)).toContain("d.deleteYn = 'N'");
    expect(departments.builder.limit).toHaveBeenCalledWith(10);
  });

  it('finds active equipment and material candidates by name or number within the company', async () => {
    const equipment = queryBuilder([{ equipmentId: 'EQ1', name: '펌프', siteId: 'SITE1' }]);
    const materials = queryBuilder([{ materialId: 'MAT1', name: '베어링' }]);
    const service = new DirectoryService(
      {} as Repository<User>,
      {} as Repository<Department>,
      { createQueryBuilder: () => equipment.builder } as unknown as Repository<Equipment>,
      { createQueryBuilder: () => materials.builder } as unknown as Repository<Material>,
    );

    expect(await service.searchEquipment('COMPANY', '펌프')).toEqual([
      { equipmentId: 'EQ1', name: '펌프', siteId: 'SITE1' },
    ]);
    expect(await service.searchMaterials('COMPANY', '베어링')).toEqual([
      { materialId: 'MAT1', name: '베어링' },
    ]);
    for (const { builder, conditions } of [equipment, materials]) {
      expect(conditions).toContainEqual([expect.stringContaining('companyId = :companyId'), { companyId: 'COMPANY' }]);
      expect(conditions.map(([sql]) => sql)).toContainEqual(expect.stringContaining("deleteYn = 'N'"));
      expect(builder.limit).toHaveBeenCalledWith(10);
    }
  });
});
