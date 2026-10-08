import { AxiosError } from 'axios'

export function toMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: unknown } | undefined)
      ?.message
    if (Array.isArray(message)) {
      return message.join(', ')
    }
    if (typeof message === 'string') {
      return message
    }
  }
  return 'Request failed'
}
