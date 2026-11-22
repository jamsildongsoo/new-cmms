/** ./bootstrap.sh admin 또는 npm run bootstrap:admin으로 명시 실행한다. DB_SYNCHRONIZE=false로 스키마 변경 없이 회사·관리자·권한을 준비한다. */
import { config as loadEnv } from 'dotenv';
import { ENV_FILE_PATH } from '../config/env-file';
import { NestFactory } from '@nestjs/core';
import { hash } from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { readBootstrapInput, type BootstrapConfig } from './bootstrap-input';
import { AppModule } from '../app.module';
import { PERMISSION_OPTIONS } from '../common/constants/permissions';
import { RolePermission } from '../identity/roles/entities/role-permission.entity';
import { Role } from '../identity/roles/entities/role.entity';
import { AccessScope, User } from '../identity/users/entities/user.entity';
import { Company } from '../organization/companies/entities/company.entity';
import { Site } from '../organization/sites/entities/site.entity';
import { Department } from '../organization/departments/entities/department.entity';

const PASSWORD_HASH_ROUNDS = 12;
const ADMIN_ROLE_ID = 'ADMIN';
const ADMIN_DEPT_ID = 'ADMIN';

loadEnv({ path: ENV_FILE_PATH, quiet: true });

async function bootstrapAdmin() {
  const config = await readBootstrapInput();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const dataSource = app.get(DataSource);
    await dataSource.transaction(async (manager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`bootstrap:${config.companyId}`],
      );
      const companyRepository = manager.getRepository(Company);
      const departmentRepository = manager.getRepository(Department);
      const roleRepository = manager.getRepository(Role);
      const rolePermissionRepository = manager.getRepository(RolePermission);
      const userRepository = manager.getRepository(User);

      await upsertCompany(companyRepository, config);
      const siteRepository = manager.getRepository(Site);
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
      const permissionIds = PERMISSION_OPTIONS.map((p) => p.permissionId);
      await upsertAdminRolePermissions(
        rolePermissionRepository,
        config,
        permissionIds,
      );
      await upsertAdminUser(userRepository, config);
    });

    console.log('Bootstrap admin completed.');
    console.log(`Company: ${config.companyId}`);
    console.log(`Admin user: ${config.adminUserId}`);
    console.log(`Admin role: ${ADMIN_ROLE_ID}`);
    console.log(`Permissions: ${PERMISSION_OPTIONS.length}`);
  } finally {
    await app.close();
  }
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
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
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
