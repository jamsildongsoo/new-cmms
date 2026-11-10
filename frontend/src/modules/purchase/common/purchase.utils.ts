export const inputDate = (date: string | null | undefined) =>
  date ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : ''
export const today = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(
    new Date(),
  )
export function previewAmount(
  quantity: string,
  unitPrice: string | null | undefined,
) {
  try {
    if (unitPrice == null || unitPrice === '') return ''
    const parse = (value: string, digits: number) => {
      if (!/^\d+(\.\d+)?$/.test(value)) throw Error()
      const [i, f = ''] = value.split('.')
      if (f.length > digits) throw Error()
      return (
        BigInt(i) * 10n ** BigInt(digits) + BigInt(f.padEnd(digits, '0') || '0')
      )
    }
    return (
      (parse(quantity, 6) * parse(unitPrice, 8) + 50000000000000n) /
      100000000000000n
    ).toString()
  } catch {
    return ''
  }
}
