import { MigrationInterface, QueryRunner } from 'typeorm';

type BootstrapAdmin = { companyId: string; userId: string };
type ReferenceColumn = { tableName: string; columnName: string };

export class OptionalInitialAdminOrganization1795418062000
  implements MigrationInterface
{
  name = 'OptionalInitialAdminOrganization1795418062000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "deptId" DROP NOT NULL`);

    // 기존 초기 관리자 중 아직 임시 조직을 사용하는 계정만 소속을 비운다.
    const bootstrapFilter = `"roleId" = 'ADMIN'
        AND "accessScope" = 'COMPANY_ALL'
        AND "siteId" = 'ADMIN'
        AND "deptId" = 'ADMIN'
        AND "createdBy" = "userId"`;
    const admins = (await queryRunner.query(
      `SELECT "companyId", "userId" FROM "user" WHERE ${bootstrapFilter}`,
    )) as BootstrapAdmin[];
    await queryRunner.query(
      `UPDATE "user" SET "siteId" = NULL, "deptId" = NULL
       WHERE ${bootstrapFilter}`,
    );

    for (const admin of admins) {
      await this.hideUnusedPlaceholder(
        queryRunner,
        'site',
        'siteId',
        admin,
      );
      await this.hideUnusedPlaceholder(
        queryRunner,
        'department',
        'deptId',
        admin,
      );
    }
  }

  private async hideUnusedPlaceholder(
    queryRunner: QueryRunner,
    table: 'site' | 'department',
    idColumn: 'siteId' | 'deptId',
    admin: BootstrapAdmin,
  ): Promise<void> {
    // 다른 사용자·업무 행·하위 부서가 참조하면 조직 행을 보존한다.
    const references = (await queryRunner.query(
      `SELECT column_info.table_name AS "tableName",
              column_info.column_name AS "columnName"
       FROM information_schema.columns column_info
       WHERE column_info.table_schema = 'public'
         AND column_info.table_name <> $1
         AND (column_info.column_name = $2 OR
              column_info.column_name LIKE $3)
         AND EXISTS (
           SELECT 1 FROM information_schema.columns company_column
           WHERE company_column.table_schema = 'public'
             AND company_column.table_name = column_info.table_name
             AND company_column.column_name = 'companyId'
         )`,
      [table, idColumn, `%${idColumn[0].toUpperCase()}${idColumn.slice(1)}`],
    )) as ReferenceColumn[];
    for (const reference of references) {
      const rows = (await queryRunner.query(
        `SELECT 1 FROM "${reference.tableName}" WHERE "companyId" = $1 AND "${reference.columnName}" = 'ADMIN' LIMIT 1`,
        [admin.companyId],
      )) as unknown[];
      if (rows.length) return;
    }

    await queryRunner.query(
      `UPDATE "${table}" SET "deleteYn" = 'Y', "updatedBy" = $2, "updatedAt" = now()
       WHERE "companyId" = $1 AND "${idColumn}" = 'ADMIN'
         AND "name" = 'Administration' AND "createdBy" = $2
         AND "deleteYn" = 'N'`,
      [admin.companyId, admin.userId],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT 1 FROM "user" WHERE "deptId" IS NULL LIMIT 1`,
    )) as unknown[];
    if (rows.length) {
      throw new Error('부서가 없는 관리자가 있어 deptId 필수 제약을 복원할 수 없습니다.');
    }
    await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "deptId" SET NOT NULL`);
  }
}
