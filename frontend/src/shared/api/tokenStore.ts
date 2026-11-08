/** 브라우저에는 access token만 저장한다. 로그아웃은 토큰 제거와 Context 해제 이벤트를 발생시킨다. */
export const ACCESS_TOKEN_KEY = 'cmms.accessToken'
export const SESSION_CLEARED_EVENT = 'cmms:session-cleared'
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}
export function setAccessToken(accessToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
}
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  window.dispatchEvent(new Event(SESSION_CLEARED_EVENT))
}
