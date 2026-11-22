import { AxiosError } from 'axios'

export function toMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const fallback: Record<number, string> = {
      400: '입력 내용을 확인해 주세요.',
      401: '로그인이 필요하거나 로그인 시간이 만료되었습니다.',
      403: '이 작업을 수행할 권한이 없습니다.',
      404: '요청한 정보를 찾을 수 없습니다.',
      409: '문서 상태가 변경되었거나 중복된 요청입니다. 새로고침 후 다시 확인해 주세요.',
      413: '첨부파일의 용량이 업로드 제한을 초과했습니다.',
    }
    const translate = (value: unknown) => {
      if (typeof value === 'string' && /[가-힣]/.test(value)) return value
      return (
        fallback[error.response?.status ?? 0] ??
        '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      )
    }
    const message = (error.response?.data as { message?: unknown } | undefined)
      ?.message
    if (Array.isArray(message)) {
      return [...new Set(message.map(translate))].join(' ')
    }
    if (typeof message === 'string') {
      return translate(message)
    }
    return translate(null)
  }
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}
