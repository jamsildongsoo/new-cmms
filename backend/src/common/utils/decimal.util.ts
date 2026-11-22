import { BadRequestException } from '@nestjs/common';
import { QUANTITY_DECIMALS, UNIT_PRICE_DECIMALS } from '../constants/numeric';

// 수량 6자리·단가 8자리·원화 금액 정수. 계산 중에는 Number를 사용하지 않는다.
export function scaled(
  value: unknown,
  digits: number,
  signed = false,
  maxIntegerDigits = 16,
): bigint {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!(signed ? /^-?\d+(\.\d+)?$/ : /^\d+(\.\d+)?$/).test(text))
    throw new BadRequestException('수량·단가는 숫자 문자열이어야 합니다.');
  const negative = text.startsWith('-');
  const [integer, fraction = ''] = text.replace('-', '').split('.');
  if (fraction.length > digits || integer.length > maxIntegerDigits)
    throw new BadRequestException('숫자의 허용 자릿수를 초과했습니다.');
  const result =
    BigInt(integer) * 10n ** BigInt(digits) +
    BigInt(fraction.padEnd(digits, '0') || '0');
  return negative ? -result : result;
}
export function decimal(value: bigint, digits = 6): string {
  const sign = value < 0n ? '-' : '',
    absolute = value < 0n ? -value : value;
  if (!digits) return `${value}`;
  const scale = 10n ** BigInt(digits);
  const fraction = (absolute % scale)
    .toString()
    .padStart(digits, '0')
    .replace(/0+$/, '');
  return `${sign}${absolute / scale}${fraction ? '.' + fraction : ''}`;
}
export function rounded(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new BadRequestException('0으로 나눌 수 없습니다.');
  return n < 0n ? -rounded(-n, d) : (n + d / 2n) / d;
}
export const qty = (value: unknown, signed = false) =>
  scaled(value, 6, signed, 14);
export const price = (value: unknown) => scaled(value, 8);
/** 신규·변경 입력에만 적용한다. 기존 고정밀 수량을 그대로 저장할 때는 보존한다. */
function assertInputDecimals(value: unknown, digits: number, field: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  const fraction = (text.split('.')[1] ?? '').replace(/0+$/, '');
  if (fraction.length > digits)
    throw new BadRequestException(
      `${field}: 소수점 ${digits}자리까지 입력할 수 있습니다.`,
    );
}
export function inputQuantity(
  value: unknown,
  signed = false,
  previous?: string,
) {
  const result = qty(value, signed);
  if (previous === undefined || result !== qty(previous, signed))
    assertInputDecimals(value, QUANTITY_DECIMALS, '수량');
  return result;
}
export function inputPrice(value: unknown) {
  const result = price(value);
  assertInputDecimals(value, UNIT_PRICE_DECIMALS, '단가');
  return result;
}
