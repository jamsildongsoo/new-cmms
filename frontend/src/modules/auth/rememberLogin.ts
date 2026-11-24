const REMEMBER_LOGIN_KEY = 'cmms.rememberedLogin'

export interface RememberedLogin {
  companyId: string
  userId: string
}

export function getRememberedLogin(): RememberedLogin | null {
  try {
    const value = localStorage.getItem(REMEMBER_LOGIN_KEY)
    if (!value) return null
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('companyId' in parsed) ||
      !('userId' in parsed) ||
      typeof parsed.companyId !== 'string' ||
      typeof parsed.userId !== 'string'
    ) return null
    return { companyId: parsed.companyId, userId: parsed.userId }
  } catch {
    return null
  }
}

export function saveRememberedLogin(value: RememberedLogin): void {
  try {
    localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify(value))
  } catch {
    // 로컬 저장을 사용할 수 없어도 로그인은 계속한다.
  }
}

export function clearRememberedLogin(): void {
  try {
    localStorage.removeItem(REMEMBER_LOGIN_KEY)
  } catch {
    // 저장소 접근이 막힌 환경에서도 화면 조작은 계속한다.
  }
}
