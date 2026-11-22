/** 업무 화면의 일시는 한국 시간으로 통일한다. */
export function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleString('sv-SE', {
        timeZone: 'Asia/Seoul',
        hour12: false,
      })
}

/** 신규 업무 입력의 오늘은 한국 날짜를 사용한다. */
export function todayDateInput(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

/** 날짜 전용 값은 시간대 변환 없이 API의 YYYYMMDD를 화면의 YYYY-MM-DD로 바꾼다. */
export function dateInput(value?: string | null): string {
  if (!value) return ''
  return /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : value
}

/** 날짜·년월 입력의 구분자를 제거해 API의 YYYYMMDD·YYYYMM으로 바꾼다. 빈 값의 null 처리는 각 폼에서 결정한다. */
export function dateValue(value?: string | null): string {
  return value ? value.replaceAll('-', '') : ''
}

/** 년월 전용 값은 API의 YYYYMM과 화면의 YYYY-MM 사이에서 변환한다. */
export function monthInput(value?: string | null): string {
  if (!value) return ''
  return /^\d{6}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4)}`
    : value
}
