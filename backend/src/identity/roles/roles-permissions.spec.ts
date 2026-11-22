import { DataSource, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { postgresTestDatabase } from '../../../test/support/pglite';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { RolesService } from './roles.service';
import { UserContext } from '../../auth/types/user-context.type';

jest.setTimeout(90000);
let db: DataSource, close: () => Promise<void>, service: RolesService;
const user = { companyId: 'A', userId: 'owner' } as UserContext;
beforeAll(async () => {
  const fixture = await postgresTestDatabase([Role, RolePermission]);
  db = fixture.dataSource;
  close = fixture.close;
  service = new RolesService(
    db.getRepository(Role),
    db.getRepository(RolePermission),
  );
});
afterAll(async () => {
  if (close) await close();
});
beforeEach(async () => {
  await db.getRepository(RolePermission).clear();
  await db.getRepository(Role).clear();
  for (const companyId of ['A', 'B']) {
    await db
      .getRepository(Role)
      .save({
        companyId,
        roleId: 'MANAGER',
        name: '관리자',
        createdBy: 'owner',
        deleteYn: 'N',
      });
    await db
      .getRepository(RolePermission)
      .save({ companyId, roleId: 'MANAGER', permissionId: 'USER:read' });
  }
});
it('provides options without a permission table and replaces only the authenticated company mapping', async () => {
  expect(await service.findPermissionOptions()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        permissionId: 'USER:update',
        moduleLabel: '사용자',
      }),
    ]),
  );
  await service.updatePermissions(user, 'MANAGER', {
    permissionIds: ['USER:update', 'USER:update'],
  });
  expect(await service.findPermissions(user, 'MANAGER')).toEqual([
    'USER:update',
  ]);
  expect(await service.findAssignedPermissionIds('B', 'MANAGER')).toEqual([
    'USER:read',
  ]);
  await service.updatePermissions(user, 'MANAGER', { permissionIds: [] });
  expect(await service.findPermissions(user, 'MANAGER')).toEqual([]);
});
it('rejects unsupported permissions and foreign-only roles before changing mappings', async () => {
  await expect(
    service.updatePermissions(user, 'MANAGER', {
      permissionIds: ['PERM:read'],
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
  await db.getRepository(Role).delete({ companyId: 'A', roleId: 'MANAGER' });
  await expect(
    service.updatePermissions(user, 'MANAGER', {
      permissionIds: ['USER:update'],
    }),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(await service.findAssignedPermissionIds('A', 'MANAGER')).toEqual([
    'USER:read',
  ]);
  expect(await service.findAssignedPermissionIds('B', 'MANAGER')).toEqual([
    'USER:read',
  ]);
});
it('rolls back removed mappings if saving replacements fails', async () => {
  const save = jest
    .spyOn(Repository.prototype, 'save')
    .mockRejectedValueOnce(new Error('write failed'));
  try {
    await expect(
      service.updatePermissions(user, 'MANAGER', {
        permissionIds: ['USER:update'],
      }),
    ).rejects.toThrow('write failed');
  } finally {
    save.mockRestore();
  }
  expect(await service.findAssignedPermissionIds('A', 'MANAGER')).toEqual([
    'USER:read',
  ]);
});
it('ignores obsolete stored mappings for authorization without deleting the rows', async () => {
  await db
    .getRepository(RolePermission)
    .save({ companyId: 'A', roleId: 'MANAGER', permissionId: 'PERM:read' });
  expect(await service.findAssignedPermissionIds('A', 'MANAGER')).toEqual([
    'USER:read',
  ]);
  expect(
    await db.getRepository(RolePermission).countBy({ companyId: 'A' }),
  ).toBe(2);
});
