import { scaledDecimal } from '@/shared/lib/numeric'
export function previewAmount(
  quantity: string,
  unitPrice: string | null | undefined,
) {
  try {
    if (unitPrice == null || unitPrice === '') return ''
    return (
      (scaledDecimal(quantity, 6) * scaledDecimal(unitPrice, 8) +
        50000000000000n) /
      100000000000000n
    ).toString()
  } catch {
    return ''
  }
}
