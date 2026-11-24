import { Repository } from 'typeorm';
import { DirectoryService } from './directory.service';
import { User } from '../../identity/users/entities/user.entity';
import { Department } from '../../organization/departments/entities/department.entity';

function queryBuilder<T>(items: T[]) {
  const conditions: Array<[string, Record<string, unknown>]> = [];
  const builder = {
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
    );

    expect(await service.searchDepartments('COMPANY', '설비')).toEqual([
      { deptId: 'D1', deptName: '설비팀' },
    ]);
    expect(departments.conditions).toContainEqual(['d.companyId = :companyId', { companyId: 'COMPANY' }]);
    expect(departments.conditions.map(([sql]) => sql)).toContain("d.deleteYn = 'N'");
    expect(departments.builder.limit).toHaveBeenCalledWith(10);
  });
});
