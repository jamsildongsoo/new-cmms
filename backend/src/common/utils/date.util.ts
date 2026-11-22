import { BadRequestException } from '@nestjs/common';
/** Date의 자동 월말 보정을 허용하지 않고 실제 달력 날짜인지 확인한다. */
export function isBusinessDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{8}$/.test(value)) return false;
  const date = new Date(
    `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`,
  );
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10).replaceAll('-', '') === value
  );
}

export function businessDate(
  value: unknown,
  optional = false,
  field?: string,
): string | null {
  if (optional && (value === null || value === undefined || value === ''))
    return null;
  if (typeof value !== 'string' || !/^\d{8}$/.test(value))
    throw new BadRequestException(
      field
        ? `${field} must be YYYYMMDD`
        : '날짜는 YYYYMMDD 형식이어야 합니다.',
    );
  if (!isBusinessDate(value))
    throw new BadRequestException(
      field ? `${field} must be a valid date` : '존재하지 않는 날짜입니다.',
    );
  return value;
}
export function monthValue(value: string) {
  if (!/^\d{6}$/.test(value))
    throw new BadRequestException('년월은 YYYYMM입니다.');
  businessDate(value + '01');
  return value;
}
export function monthAfter(value: string, offset = 1) {
  monthValue(value);
  const year = Number(value.slice(0, 4)),
    month = Number(value.slice(4));
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
