import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { AccessScope, User } from './entities/user.entity';
import { Site } from '../../organization/sites/entities/site.entity';
import { UserContext } from '../../auth/types/user-context.type';

const context = { companyId: 'CR', userId: 'admin' } as UserContext;

function fixture() {
  const user = {
    companyId: 'CR',
    userId: 'worker',
    name: 'Worker',
    siteId: 'OLD-SITE',
    deptId: 'OLD-DEPT',
    roleId: 'WORKER',
    accessScope: AccessScope.OWN_DEPARTMENT,
    deleteYn: 'N',
  } as User;
  const manager = {
    findOneBy: jest.fn(async (entity: unknown, where: unknown) =>
      (where as { deleteYn?: string }).deleteYn === 'N'
        ? null
        : entity === Site
          ? { name: 'Old site', deleteYn: 'Y' }
          : { name: 'Old department', deleteYn: 'Y' },
    ),
    find: jest.fn(async (_entity: unknown, _options: unknown) => []),
  };
  const repository = {
    manager,
    findOneBy: jest.fn(async () => user as User | null),
    find: jest.fn(async () => [user]),
    create: (value: User) => value,
    save: jest.fn(async (value: User) => value),
    update: jest.fn(async (_where: unknown, patch: Partial<User>) => {
      Object.assign(
        user,
        Object.fromEntries(
          Object.entries(patch).filter(([, value]) => value !== undefined),
        ),
      );
      return { affected: 1 };
    }),
  };
  return {
    service: new UsersService(repository as unknown as Repository<User>),
    user,
    manager,
    repository,
  };
}

describe('UsersService organization selection', () => {
  it('keeps deleted site/department IDs while active-only display lookups return no name', async () => {
    const { service, manager } = fixture();
    const saved = await service.update(context, 'worker', { name: 'Renamed' });
    expect(saved).toMatchObject({
      name: 'Renamed',
      siteId: 'OLD-SITE',
      deptId: 'OLD-DEPT',
      siteName: null,
      deptName: null,
    });
    for (const call of manager.findOneBy.mock.calls) {
      expect(call[1]).toMatchObject({ companyId: 'CR', deleteYn: 'N' });
    }
  });

  it('saves selected IDs without rejecting missing reference rows', async () => {
    const { service, manager, repository } = fixture();
    repository.findOneBy.mockResolvedValueOnce(null);
    manager.findOneBy.mockResolvedValue(null as never);
    const saved = await service.create(context, {
      userId: 'new',
      password: 'test-password',
      name: 'New user',
      siteId: 'SELECTED-SITE',
      deptId: 'SELECTED-DEPT',
      roleId: 'WORKER',
      accessScope: AccessScope.OWN_SITE,
    });
    expect(saved.siteId).toBe('SELECTED-SITE');
    expect(saved.deptId).toBe('SELECTED-DEPT');
    expect(saved).not.toHaveProperty('passwordHash');
    expect(saved).not.toHaveProperty('password');
  });

  it('scopes new selection lists to active records of the authenticated company', async () => {
    const { service, manager } = fixture();
    expect(await service.findOptions(context)).toEqual({
      sites: [],
      departments: [],
      roles: [],
    });
    expect(manager.find).toHaveBeenCalledTimes(3);
    for (const call of manager.find.mock.calls) {
      expect(call[1]).toMatchObject({
        where: { companyId: 'CR', deleteYn: 'N' },
      });
    }
  });

  it('keeps normal users assigned and permits the initial admin to remain unassigned', async () => {
    const { service, user, manager } = fixture();
    await expect(
      service.update(context, 'worker', { deptId: null }),
    ).rejects.toThrow('deptId');

    user.roleId = 'ADMIN';
    user.accessScope = AccessScope.COMPANY_ALL;
    user.siteId = null;
    user.deptId = null;
    const saved = await service.update(context, 'worker', {
      name: 'Administrator',
      siteId: null,
      deptId: null,
    });
    expect(saved).toMatchObject({
      name: 'Administrator',
      siteId: null,
      deptId: null,
    });
    expect(manager.findOneBy).not.toHaveBeenCalled();
    await expect(
      service.update(context, 'worker', { roleId: 'WORKER' }),
    ).rejects.toThrow('siteId and deptId');
    await expect(
      service.update(context, 'worker', { siteId: 'SITE' }),
    ).rejects.toThrow('siteId and deptId');
  });
});
