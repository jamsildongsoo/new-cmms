import { postgresTestDatabase } from '../../../test/support/pglite';
import { User } from '../../identity/users/entities/user.entity';
import { Site } from '../../organization/sites/entities/site.entity';
import { Department } from '../../organization/departments/entities/department.entity';
import { OptionalInitialAdminOrganization1795418062000 } from './1795418062000-OptionalInitialAdminOrganization';

it('clears bootstrap admin organization and hides only unused placeholder rows', async () => {
  const { dataSource, close } = await postgresTestDatabase([
    User,
    Site,
    Department,
  ]);
  try {
    await dataSource.query(
      `ALTER TABLE "user" ALTER COLUMN "deptId" SET NOT NULL`,
    );
    for (const companyId of ['A', 'B']) {
      await dataSource.query(
        `INSERT INTO "site" ("companyId", "siteId", "name", "createdBy")
         VALUES ($1, 'ADMIN', 'Administration', 'admin')`,
        [companyId],
      );
      await dataSource.query(
        `INSERT INTO "department" ("companyId", "deptId", "name", "createdBy")
         VALUES ($1, 'ADMIN', 'Administration', 'admin')`,
        [companyId],
      );
      await dataSource.query(
        `INSERT INTO "user" ("companyId", "userId", "passwordHash", "name",
                            "roleId", "siteId", "deptId", "accessScope", "createdBy")
         VALUES ($1, 'admin', 'hash', 'admin', 'ADMIN', 'ADMIN', 'ADMIN',
                 'COMPANY_ALL', 'admin')`,
        [companyId],
      );
    }
    await dataSource.query(
      `INSERT INTO "user" ("companyId", "userId", "passwordHash", "name",
                          "roleId", "siteId", "deptId", "accessScope", "createdBy")
       VALUES ('B', 'worker', 'hash', 'worker', 'WORKER', 'ADMIN', 'ADMIN',
               'OWN_DEPARTMENT', 'admin')`,
    );

    const queryRunner = dataSource.createQueryRunner();
    try {
      await new OptionalInitialAdminOrganization1795418062000().up(queryRunner);
    } finally {
      await queryRunner.release();
    }

    const admins = (await dataSource.query(
      `SELECT "companyId", "siteId", "deptId" FROM "user"
       WHERE "userId" = 'admin' ORDER BY "companyId"`,
    )) as { companyId: string; siteId: string | null; deptId: string | null }[];
    expect(admins).toEqual([
      { companyId: 'A', siteId: null, deptId: null },
      { companyId: 'B', siteId: null, deptId: null },
    ]);
    for (const table of ['site', 'department']) {
      const rows = (await dataSource.query(
        `SELECT "companyId", "deleteYn" FROM "${table}" ORDER BY "companyId"`,
      )) as { companyId: string; deleteYn: string }[];
      expect(rows).toEqual([
        { companyId: 'A', deleteYn: 'Y' },
        { companyId: 'B', deleteYn: 'N' },
      ]);
    }
  } finally {
    await close();
  }
});
