/** 서버 로그인·/auth/me 결과만 Context에 보관하고 복원·탭 변경·늦은 응답의 세션 경합을 제어한다. */
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { getMe, login as loginRequest } from './auth.api'
import type { LoginRequest, UserContext } from '@/shared/types/auth'
import { AuthContext } from './authContext'
import {
  ACCESS_TOKEN_KEY,
  SESSION_CLEARED_EVENT,
  clearTokens,
  getAccessToken,
  setAccessToken,
} from '@/shared/api/tokenStore'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserContext | null>(null)
  const [loading, setLoading] = useState(Boolean(getAccessToken()))
  const [error, setError] = useState('')
  const version = useRef(0),
    knownToken = useRef(getAccessToken()),
    authenticating = useRef(false)
  const invalidate = useCallback(() => {
    ++version.current
  }, [])
  const reset = useCallback(() => {
    ++version.current
    knownToken.current = null
    setUser(null)
    setLoading(false)
    setError('')
  }, [])
  const reloadUser = useCallback(async () => {
    const request = ++version.current,
      token = getAccessToken()
    if (!token) {
      reset()
      return
    }
    if (token !== knownToken.current) setUser(null)
    knownToken.current = token
    setLoading(true)
    setError('')
    try {
      // Context는 표시/버튼 제어용이다. 회사·사용자·권한은 서버 /auth/me의 DB 조회 결과만 사용한다.
      const current = await getMe()
      if (request === version.current && getAccessToken() === token)
        setUser(current)
    } catch {
      // 인증 만료(401)는 http에서 해제한다. 일시적 통신 실패는 토큰을 보존하고 재시도를 제공한다.
      if (request === version.current && getAccessToken() === token)
        setError(
          '사용자 정보를 확인하지 못했습니다. 연결 상태를 확인한 후 다시 시도하십시오.',
        )
    } finally {
      if (request === version.current) setLoading(false)
    }
  }, [reset])
  useEffect(() => {
    let active = true
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACCESS_TOKEN_KEY || event.key === null)
        void reloadUser()
    }
    const onFocus = () => {
      if (authenticating.current) return
      if (getAccessToken()) void reloadUser()
      else reset()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') onFocus()
    }
    window.addEventListener(SESSION_CLEARED_EVENT, reset)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    void Promise.resolve().then(() => {
      if (active) return reloadUser()
    })
    return () => {
      active = false
      invalidate()
      window.removeEventListener(SESSION_CLEARED_EVENT, reset)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reloadUser, reset, invalidate])
  const login = useCallback(async (payload: LoginRequest) => {
    const request = ++version.current
    authenticating.current = true
    try {
      const response = await loginRequest(payload)
      if (request !== version.current) return
      setAccessToken(response.accessToken)
      knownToken.current = response.accessToken
      setUser(response.user)
      setError('')
      setLoading(false)
    } finally {
      authenticating.current = false
    }
  }, [])
  const logout = useCallback(async () => {
    clearTokens()
    reset()
  }, [reset])
  const hasPermission = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user],
  )
  const value = useMemo(
    () => ({ user, loading, error, reloadUser, login, logout, hasPermission }),
    [user, loading, error, reloadUser, login, logout, hasPermission],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
