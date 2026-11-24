/** npm run init:admin으로 회사와 초기 관리자를 명시적으로 생성한다. */
import { config as loadEnv } from 'dotenv';
import { ENV_FILE_PATH } from '../config/env-file';
import { NestFactory } from '@nestjs/core';
import { hash } from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { readInitialAdminInput, type InitialAdminInput } from './init-admin-input';
import { AppModule } from '../app.module';
import { PERMISSION_OPTIONS } from '../common/constants/permissions';
import { RolePermission } from '../identity/roles/entities/role-permission.entity';
import { Role } from '../identity/roles/entities/role.entity';
import { AccessScope, User } from '../identity/users/entities/user.entity';
import { Company } from '../organization/companies/entities/company.entity';

const PASSWORD_HASH_ROUNDS = 12;
const ADMIN_ROLE_ID = 'ADMIN';

loadEnv({ path: ENV_FILE_PATH, quiet: true });

async function initializeAdmin() {
  const config = await readInitialAdminInput();
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
      const roleRepository = manager.getRepository(Role);
      const rolePermissionRepository = manager.getRepository(RolePermission);
      const userRepository = manager.getRepository(User);

      await upsertCompany(companyRepository, config);
      await upsertAdminRole(roleRepository, config);
      const permissionIds = PERMISSION_OPTIONS.map((p) => p.permissionId);
      await upsertAdminRolePermissions(
        rolePermissionRepository,
        config,
        permissionIds,
      );
      await upsertAdminUser(userRepository, config);
    });

    console.log('Initial admin created.');
    console.log(`Company: ${config.companyId}`);
    console.log(`Admin user: ${config.userId}`);
    console.log(`Admin role: ${ADMIN_ROLE_ID}`);
    console.log(`Permissions: ${PERMISSION_OPTIONS.length}`);
  } finally {
    await app.close();
  }
}

async function upsertCompany(
  repository: Repository<Company>,
  config: InitialAdminInput,
): Promise<void> {
  const company = await repository.findOneBy({ companyId: config.companyId });

  if (!company) {
    await repository.save(
      repository.create({
        companyId: config.companyId,
        name: config.companyId,
        deleteYn: 'N',
        createdBy: config.userId,
      }),
    );
    return;
  }

  if (company.deleteYn !== 'N')
    throw new Error('삭제된 회사 코드입니다. 회사 상태를 먼저 확인하세요.');
  // 이미 화면에서 수정한 회사명은 유지한다.
}

async function upsertAdminRole(
  repository: Repository<Role>,
  config: InitialAdminInput,
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
        createdBy: config.userId,
      }),
    );
    return;
  }

  if (role.deleteYn !== 'N')
    throw new Error('ADMIN 역할이 비활성 상태입니다.');
}

async function upsertAdminRolePermissions(
  repository: Repository<RolePermission>,
  config: InitialAdminInput,
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
  const newRolePermissions = permissionIds
    .filter((permissionId) => !existingPermissionIds.has(permissionId))
    .map((permissionId) =>
      repository.create({
        companyId: config.companyId,
        roleId: ADMIN_ROLE_ID,
        permissionId,
      }),
    );

  await repository.save(newRolePermissions);
}

async function upsertAdminUser(
  repository: Repository<User>,
  config: InitialAdminInput,
): Promise<void> {
  const user = await repository.findOneBy({
    companyId: config.companyId,
    userId: config.userId,
  });

  if (user) throw new Error('이 회사에 동일한 사용자 ID가 이미 있습니다.');
  await repository.save(
    repository.create({
      companyId: config.companyId,
      userId: config.userId,
      passwordHash: await hash(config.password, PASSWORD_HASH_ROUNDS),
      name: config.userId,
      roleId: ADMIN_ROLE_ID,
      siteId: null,
      deptId: null,
      accessScope: AccessScope.COMPANY_ALL,
      deleteYn: 'N',
      createdBy: config.userId,
    }),
  );
}

void initializeAdmin().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
