/** 지정 회사의 초기 관리자와 실제 Controller 권한을 준비한다. 운영 DB 적용은 명시적 명령으로만 수행한다. */
import { InventoryService } from '../inventory/transactions/inventory.service';
import { UserContext } from '../auth/types/user-context.type';
import { config as loadEnv } from 'dotenv';
import { ModulesContainer, NestFactory } from '@nestjs/core';
import { Type } from '@nestjs/common';
import { hash } from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { findModule } from '../common/constants/modules';
import { collectControllerPermissions } from './controller-permissions';
import { Permission } from '../identity/permissions/entities/permission.entity';
import { RolePermission } from '../identity/roles/entities/role-permission.entity';
import { Role } from '../identity/roles/entities/role.entity';
import { AccessScope, User } from '../identity/users/entities/user.entity';
import { Company } from '../organization/companies/entities/company.entity';
import { Site } from '../organization/sites/entities/site.entity';
import { Department } from '../organization/departments/entities/department.entity';

const PASSWORD_HASH_ROUNDS = 12;
const ADMIN_ROLE_ID = 'ADMIN';
const ADMIN_DEPT_ID = 'ADMIN';

loadEnv({ quiet: true });

interface BootstrapConfig {
  companyId: string;
  companyName: string;
  adminUserId: string;
  adminPassword: string;
  adminName: string;
  forcePassword: boolean;
}

async function bootstrapAdmin() {
  const config = readBootstrapConfig();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const dataSource = app.get(DataSource);
    const companyRepository = dataSource.getRepository(Company);
    const departmentRepository = dataSource.getRepository(Department);
    const roleRepository = dataSource.getRepository(Role);
    const permissionRepository = dataSource.getRepository(Permission);
    const rolePermissionRepository = dataSource.getRepository(RolePermission);
    const userRepository = dataSource.getRepository(User);

    await upsertCompany(companyRepository, config);
    const siteRepository = dataSource.getRepository(Site);
    const adminSite = await siteRepository.findOneBy({
      companyId: config.companyId,
      siteId: 'ADMIN',
    });
    if (!adminSite) {
      await siteRepository.save(
        siteRepository.create({
          companyId: config.companyId,
          siteId: 'ADMIN',
          name: 'Administration',
          deleteYn: 'N',
          createdBy: config.adminUserId,
        }),
      );
    }
    await upsertAdminDepartment(departmentRepository, config);
    await upsertAdminRole(roleRepository, config);
    const controllers: Type<unknown>[] = [];
    for (const module of app.get(ModulesContainer).values())
      for (const wrapper of module.controllers.values())
        if (wrapper.metatype)
          controllers.push(wrapper.metatype as Type<unknown>);
    const permissionIds = await upsertPermissions(
      permissionRepository,
      config,
      collectControllerPermissions(controllers),
    );
    await upsertAdminRolePermissions(
      rolePermissionRepository,
      config,
      permissionIds,
    );
    await upsertAdminUser(userRepository, config);
    await app.get(InventoryService).initializeTypes({
      companyId: config.companyId,
      userId: config.adminUserId,
      roleId: ADMIN_ROLE_ID,
      siteId: 'ADMIN',
      deptId: ADMIN_DEPT_ID,
      accessScope: 'COMPANY_ALL',
      permissions: [],
    } as UserContext);

    console.log('Bootstrap admin completed.');
    console.log(`Company: ${config.companyId}`);
    console.log(`Admin user: ${config.adminUserId}`);
    console.log(`Admin role: ${ADMIN_ROLE_ID}`);
    console.log(`Permissions: ${permissionIds.length}`);
  } finally {
    await app.close();
  }
}

function readBootstrapConfig(): BootstrapConfig {
  return {
    companyId: readEnv('BOOTSTRAP_COMPANY_ID', 'CR'),
    companyName: readEnv('BOOTSTRAP_COMPANY_NAME', 'Core Company'),
    adminUserId: readEnv('BOOTSTRAP_ADMIN_USER_ID', 'admin'),
    adminPassword: readEnv('BOOTSTRAP_ADMIN_PASSWORD'),
    adminName: readEnv('BOOTSTRAP_ADMIN_NAME', 'System Admin'),
    forcePassword: readBooleanEnv('BOOTSTRAP_ADMIN_FORCE_PASSWORD', false),
  };
}

function readEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value.trim() === '') {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function readBooleanEnv(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new Error(`${key} must be true or false`);
}

async function upsertCompany(
  repository: Repository<Company>,
  config: BootstrapConfig,
): Promise<void> {
  const company = await repository.findOneBy({ companyId: config.companyId });

  if (!company) {
    await repository.save(
      repository.create({
        companyId: config.companyId,
        name: config.companyName,
        deleteYn: 'N',
        createdBy: config.adminUserId,
      }),
    );
    return;
  }

  company.name = config.companyName;
  company.deleteYn = 'N';
  company.updatedBy = config.adminUserId;
  company.updatedAt = new Date();
  await repository.save(company);
}

async function upsertAdminDepartment(
  repository: Repository<Department>,
  config: BootstrapConfig,
): Promise<void> {
  const department = await repository.findOneBy({
    companyId: config.companyId,
    deptId: ADMIN_DEPT_ID,
  });

  if (!department) {
    await repository.save(
      repository.create({
        companyId: config.companyId,
        deptId: ADMIN_DEPT_ID,
        name: 'Administration',
        deleteYn: 'N',
        createdBy: config.adminUserId,
      }),
    );
    return;
  }

  department.name = 'Administration';
  department.deleteYn = 'N';
  department.updatedBy = config.adminUserId;
  department.updatedAt = new Date();
  await repository.save(department);
}

async function upsertAdminRole(
  repository: Repository<Role>,
  config: BootstrapConfig,
): Promise<void> {
  const role = await repository.findOneBy({
    companyId: config.companyId,
    roleId: ADMIN_ROLE_ID,
  });

  if (!role) {
    await repository.save(
      repository.create({
        companyId: config.companyId,
        roleId: ADMIN_ROLE_ID,
        name: 'Administrator',
        deleteYn: 'N',
        createdBy: config.adminUserId,
      }),
    );
    return;
  }

  role.name = 'Administrator';
  role.deleteYn = 'N';
  role.updatedBy = config.adminUserId;
  role.updatedAt = new Date();
  await repository.save(role);
}

async function upsertPermissions(
  repository: Repository<Permission>,
  config: BootstrapConfig,
  permissionIds: string[],
): Promise<string[]> {
  const existingPermissions = await repository.findBy(
    permissionIds.map((permissionId) => ({ permissionId })),
  );
  const existingPermissionMap = new Map(
    existingPermissions.map((permission) => [
      permission.permissionId,
      permission,
    ]),
  );

  const permissions = permissionIds.map((permissionId) => {
    const [module, action] = permissionId.split(':');
    const existingPermission = existingPermissionMap.get(permissionId);

    if (existingPermission) {
      existingPermission.module = module;
      existingPermission.action = action;
      existingPermission.name = formatPermissionName(module, action);
      existingPermission.deleteYn = 'N';
      existingPermission.updatedBy = config.adminUserId;
      existingPermission.updatedAt = new Date();
      return existingPermission;
    }

    return repository.create({
      permissionId,
      module,
      action,
      name: formatPermissionName(module, action),
      deleteYn: 'N',
      createdBy: config.adminUserId,
    });
  });

  await repository.save(permissions);
  return permissionIds;
}

function formatPermissionName(module: string, action: string): string {
  const labels: Record<string, string> = {
    create: '등록',
    read: '조회',
    update: '수정',
    delete: '삭제',
  };
  return `${findModule(module)?.name ?? module} ${labels[action] ?? action}`;
}

async function upsertAdminRolePermissions(
  repository: Repository<RolePermission>,
  config: BootstrapConfig,
  permissionIds: string[],
): Promise<void> {
  const existingRolePermissions = await repository.find({
    where: {
      companyId: config.companyId,
      roleId: ADMIN_ROLE_ID,
    },
  });
  const existingPermissionIds = new Set(
    existingRolePermissions.map(
      (rolePermission) => rolePermission.permissionId,
    ),
  );
  const permissionIdSet = new Set(permissionIds);
  const removedRolePermissions = existingRolePermissions.filter(
    (rolePermission) => !permissionIdSet.has(rolePermission.permissionId),
  );
  const newRolePermissions = permissionIds
    .filter((permissionId) => !existingPermissionIds.has(permissionId))
    .map((permissionId) =>
      repository.create({
        companyId: config.companyId,
        roleId: ADMIN_ROLE_ID,
        permissionId,
      }),
    );

  await repository.remove(removedRolePermissions);
  await repository.save(newRolePermissions);
}

async function upsertAdminUser(
  repository: Repository<User>,
  config: BootstrapConfig,
): Promise<void> {
  const user = await repository.findOneBy({
    companyId: config.companyId,
    userId: config.adminUserId,
  });

  if (!user) {
    await repository.save(
      repository.create({
        companyId: config.companyId,
        userId: config.adminUserId,
        passwordHash: await hash(config.adminPassword, PASSWORD_HASH_ROUNDS),
        name: config.adminName,
        roleId: ADMIN_ROLE_ID,
        siteId: 'ADMIN',
        deptId: ADMIN_DEPT_ID,
        accessScope: AccessScope.COMPANY_ALL,
        deleteYn: 'N',
        createdBy: config.adminUserId,
      }),
    );
    return;
  }

  if (config.forcePassword) {
    user.passwordHash = await hash(config.adminPassword, PASSWORD_HASH_ROUNDS);
  }

  user.name = config.adminName;
  user.roleId = ADMIN_ROLE_ID;
  user.siteId ??= 'ADMIN';
  user.deptId = ADMIN_DEPT_ID;
  user.accessScope = AccessScope.COMPANY_ALL;
  user.deleteYn = 'N';
  user.updatedBy = config.adminUserId;
  user.updatedAt = new Date();
  await repository.save(user);
}

void bootstrapAdmin().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
