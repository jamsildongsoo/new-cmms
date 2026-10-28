import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { hash } from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { AppModuleKey } from '../common/constants/modules';
import {
  buildPermissionCode,
  PermissionAction,
} from '../common/constants/permissions';
import { Permission } from '../identity/permissions/entities/permission.entity';
import { RolePermission } from '../identity/roles/entities/role-permission.entity';
import { Role } from '../identity/roles/entities/role.entity';
import { AccessScope, User } from '../identity/users/entities/user.entity';
import { Company } from '../organization/companies/entities/company.entity';
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
    await upsertAdminDepartment(departmentRepository, config);
    await upsertAdminRole(roleRepository, config);
    const permissionIds = await upsertPermissions(permissionRepository, config);
    await upsertAdminRolePermissions(
      rolePermissionRepository,
      config,
      permissionIds,
    );
    await upsertAdminUser(userRepository, config);

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
): Promise<string[]> {
  const permissionIds = buildBootstrapPermissionIds();
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

function buildBootstrapPermissionIds(): string[] {
  const moduleKeys = Object.values(AppModuleKey);
  const actions = Object.values(PermissionAction);

  return moduleKeys
    .flatMap((moduleKey) =>
      actions.map((action) => buildPermissionCode(moduleKey, action)),
    )
    .sort();
}

function formatPermissionName(module: string, action: string): string {
  return `${module.replaceAll('_', ' ')} ${action}`;
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
