/** 만료된 access token은 refresh 쿠키로 한 번 갱신한 뒤 원 요청을 재시도한다. */
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { clearTokens, getAccessToken, setAccessToken } from './tokenStore'
const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? '/api'
export const http = axios.create({ baseURL: apiBaseUrl, timeout: 15000, withCredentials: true })
type RetryConfig = InternalAxiosRequestConfig & { _retried?: boolean }
let refreshRequest: Promise<string> | null = null
let lastRefresh: { previous: string; next: string } | null = null

function refreshAccessToken(): Promise<string> {
  if (!refreshRequest) {
    refreshRequest = axios.post<{ accessToken: string }>(
      `${apiBaseUrl.replace(/\/$/, '')}/auth/refresh`,
      {},
      { timeout: 15000, withCredentials: true },
    ).then(({ data }) => {
      if (typeof data.accessToken !== 'string' || !data.accessToken)
        throw new Error('Refresh response has no access token')
      return data.accessToken
    }).finally(() => { refreshRequest = null })
  }
  return refreshRequest
}
http.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const token = getAccessToken(),
      original = error.config as RetryConfig | undefined
    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      lastRefresh &&
      token === lastRefresh.next &&
      original.headers.Authorization === `Bearer ${lastRefresh.previous}`
    ) {
      original._retried = true
      original.headers.Authorization = `Bearer ${token}`
      return http(original)
    }
    // 이전 세션의 늦은 응답으로 새 로그인을 해제하지 않는다. 권한 거부(403)와 통신 오류도 구분한다.
    if (
      error.response?.status === 401 &&
      token &&
      original &&
      !original._retried &&
      !['/auth/login', '/auth/refresh', '/auth/logout'].includes(original.url ?? '') &&
      original?.headers.Authorization === `Bearer ${token}`
    ) {
      original._retried = true
      let freshToken: string | null = null
      try {
        freshToken = await refreshAccessToken()
        if (getAccessToken() === token) {
          lastRefresh = { previous: token, next: freshToken }
          setAccessToken(freshToken)
        }
        if (getAccessToken() !== freshToken) return Promise.reject(error)
        original.headers.Authorization = `Bearer ${freshToken}`
        return await http(original)
      } catch (failure) {
        if (
          axios.isAxiosError(failure) &&
          failure.response?.status === 401 &&
          getAccessToken() === (freshToken ?? token)
        ) clearTokens()
      }
    }
    return Promise.reject(error)
  },
)
