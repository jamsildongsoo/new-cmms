import { BadRequestException } from '@nestjs/common';

/** 월·년 주기는 대상 월 말일로 보정한다. 예: 1월 31일 + 1개월 → 2월 말일. */
export function nextInspectionDate(
  value: string | null,
  period: number | null,
  unit: string | null,
): string | null {
  if (!value || !period || period < 0 || !Number.isInteger(period) || !unit)
    return null;
  const date = new Date(
    `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`,
  );
  if (unit === 'DAY' || unit === 'WEEK') {
    date.setUTCDate(date.getUTCDate() + period * (unit === 'WEEK' ? 7 : 1));
  } else if (unit === 'MONTH' || unit === 'YEAR') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + period * (unit === 'YEAR' ? 12 : 1));
    const last = new Date(date.getTime());
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    date.setUTCDate(Math.min(day, last.getUTCDate()));
  } else return null;
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999)
    throw new BadRequestException('Inspection cycle exceeds supported dates');
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}
