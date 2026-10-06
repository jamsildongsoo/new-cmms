import { BadRequestException } from '@nestjs/common';
import { PaginationQueryDto } from '../dto/pagination-query.dto';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export interface NormalizedPagination {
  page: number;
  limit: number;
  offset: number;
}

export function normalizePaginationQuery(
  query: PaginationQueryDto,
): NormalizedPagination {
  const page = parsePositiveInteger(query.page, DEFAULT_PAGE, 'page');
  const requestedLimit = parsePositiveInteger(
    query.limit,
    DEFAULT_PAGE_LIMIT,
    'limit',
  );
  const limit = Math.min(requestedLimit, MAX_PAGE_LIMIT);

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function parsePositiveInteger(
  value: number | string | undefined,
  fallback: number,
  fieldName: string,
): number {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsedValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new BadRequestException(`${fieldName} must be a positive integer`);
  }

  return parsedValue;
}
