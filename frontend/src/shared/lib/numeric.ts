/** 자릿수 원본: backend/src/common/constants/numeric.ts. 실행 기준은 metadata에서 받는다. */
export interface NumericPrecision {
  quantity: number
  unitPrice: number
}
export function formatDecimal(
  value: string | number | null | undefined,
  digits: number,
): string {
  if (value == null || value === '') return ''
  const text = String(value)
  if (!/^-?\d+(\.\d+)?$/.test(text)) return text
  const negative = text.startsWith('-')
  const [integer, fraction = ''] = text.replace('-', '').split('.')
  const scale = 10n ** BigInt(digits)
  let scaled =
    BigInt(integer) * scale +
    BigInt(fraction.slice(0, digits).padEnd(digits, '0') || '0')
  if (Number(fraction[digits] ?? '0') >= 5) scaled += 1n
  const decimal = (scaled % scale)
    .toString()
    .padStart(digits, '0')
    .replace(/0+$/, '')
  return `${negative && scaled !== 0n ? '-' : ''}${scaled / scale}${digits && decimal ? '.' + decimal : ''}`
}
export function validDecimalInput(
  value: string,
  digits: number,
  signed = false,
) {
  return (
    new RegExp(
      String.raw`^${signed ? '-?' : ''}\d*(?:\.\d{0,${digits}})?$`,
    ).test(value) &&
    (digits > 0 || !value.includes('.'))
  )
}
/** 소수 문자열을 정확하게 배율 적용 정수로 변환한다. 금액 계산식은 각 업무에 둔다. */
export function scaledDecimal(value: string, digits: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error('숫자를 입력하십시오.')
  const [integer, fraction = ''] = value.split('.')
  if (fraction.length > digits)
    throw new Error('허용 소수 자릿수를 초과했습니다.')
  return (
    BigInt(integer) * 10n ** BigInt(digits) +
    BigInt(fraction.padEnd(digits, '0') || '0')
  )
}
