/** 현재 access token을 요청에 연결하며 해당 토큰의 401만 세션을 해제한다. 403·통신 오류는 보존한다. */
import axios, { AxiosError } from 'axios'
import { clearTokens, getAccessToken } from './tokenStore'
const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'
export const http = axios.create({ baseURL: apiBaseUrl, timeout: 15000 })
http.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const token = getAccessToken(),
      original = error.config
    // 이전 세션의 늦은 응답으로 새 로그인을 해제하지 않는다. 권한 거부(403)와 통신 오류도 구분한다.
    if (
      error.response?.status === 401 &&
      token &&
      original?.url !== '/auth/login' &&
      original?.headers.Authorization === `Bearer ${token}`
    )
      clearTokens()
    return Promise.reject(error)
  },
)
