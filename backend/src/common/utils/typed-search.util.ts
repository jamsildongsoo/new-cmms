import { BadRequestException } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/** 검색 유형은 서버가 지정한 SQL 식에만 매핑한다. 입력값은 항상 바인딩한다. */
export function applyTypedSearch<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  search: string | undefined,
  searchType: string | undefined,
  columns: Record<string, string>,
  fallback: string[],
) {
  if (searchType && !Object.prototype.hasOwnProperty.call(columns, searchType)) {
    throw new BadRequestException('Invalid searchType');
  }
  const keyword = search?.trim();
  if (!keyword) return;
  const expressions = searchType ? [columns[searchType]] : fallback;
  const clause = expressions.map((column) => `${column} ILIKE :search`).join(' OR ');
  query.andWhere(`(${clause})`, {
    search: `%${keyword.replace(/[\\%_]/g, '\\$&')}%`,
  });
}
