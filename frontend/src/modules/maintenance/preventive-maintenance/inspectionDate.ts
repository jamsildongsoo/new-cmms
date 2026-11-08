/** 날짜 입력값(YYYY-MM-DD)을 받아 월말·윤년을 보정한 다음 점검일을 제안한다. */
export function calculateNextInspectionDate(
  value: string,
  period: number | null,
  unit: string | null,
): string {
  if (!value || !period || period < 0 || !Number.isInteger(period) || !unit)
    return ''
  const date = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(date.getTime())) return ''
  if (unit === 'DAY' || unit === 'WEEK') {
    date.setUTCDate(date.getUTCDate() + period * (unit === 'WEEK' ? 7 : 1))
  } else if (unit === 'MONTH' || unit === 'YEAR') {
    const day = date.getUTCDate()
    date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth() + period * (unit === 'YEAR' ? 12 : 1))
    const last = new Date(date.getTime())
    last.setUTCMonth(last.getUTCMonth() + 1, 0)
    date.setUTCDate(Math.min(day, last.getUTCDate()))
  } else return ''
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() <= 9999
    ? date.toISOString().slice(0, 10)
    : ''
}
