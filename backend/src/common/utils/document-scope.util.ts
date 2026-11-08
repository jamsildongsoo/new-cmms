/** 인증 회사 조건을 먼저 고정하고 회사/사업장/하위 부서 문서 범위를 적용한다. */
import { ForbiddenException } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';

/** 사용자 입력이 아닌 내부 alias만 전달한다. 회사 조건 뒤에 문서 범위를 추가한다. */
export function applyDocumentScope<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  user: UserContext,
  alias: string,
) {
  query
    .where(`${alias}.companyId = :companyId`, { companyId: user.companyId })
    .andWhere(`${alias}.deleteYn = :deleteYn`, { deleteYn: 'N' });
  if (user.accessScope === 'COMPANY_ALL') return query;
  if (user.accessScope === 'OWN_SITE' && user.siteId)
    return query.andWhere(`${alias}.siteId = :scopeSiteId`, {
      scopeSiteId: user.siteId,
    });
  if (user.accessScope === 'OWN_DEPARTMENT' && user.deptId) {
    return query.andWhere(
      `${alias}.deptId IN (
      WITH RECURSIVE scope_departments AS (
        SELECT "deptId" FROM "department" WHERE "companyId" = :companyId AND "deptId" = :scopeDeptId AND "deleteYn" = 'N'
        UNION
        SELECT d."deptId" FROM "department" d JOIN scope_departments p ON d."parentDeptId" = p."deptId"
        WHERE d."companyId" = :companyId AND d."deleteYn" = 'N'
      ) SELECT "deptId" FROM scope_departments
    )`,
      { scopeDeptId: user.deptId },
    );
  }
  throw new ForbiddenException(
    'Document access scope or affiliation is missing',
  );
}
