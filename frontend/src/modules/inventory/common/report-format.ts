import { formatDecimal, type NumericPrecision } from '@/shared/lib/numeric'

export function formatStockValue(
  key: string,
  value: unknown,
  precision: NumericPrecision,
) {
  if (value == null) return ''
  if (
    key === 'quantity' ||
    /Quantity$/.test(key) ||
    key === 'quantityChange'
  )
    return formatDecimal(String(value), precision.quantity)
  if (key === 'unitPrice' || key === 'averagePrice')
    return formatDecimal(String(value), precision.unitPrice)
  return String(value)
}
