import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  getMe,
  login as loginRequest,
  logout as logoutRequest,
} from './auth.api'
import type { LoginRequest, UserContext } from '@/shared/types/auth'
import { AuthContext } from './authContext'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '@/shared/api/tokenStore'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserContext | null>(null)
  const [loading, setLoading] = useState(Boolean(getAccessToken()))

  useEffect(() => {
    const accessToken = getAccessToken()
    if (!accessToken) {
      return
    }

    let ignore = false

    void getMe()
      .then((currentUser) => {
        if (!ignore) {
          setUser(currentUser)
        }
      })
      .catch(() => {
        if (!ignore) {
          clearTokens()
          setUser(null)
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [])

  const login = useCallback(async (payload: LoginRequest) => {
    const response = await loginRequest(payload)
    setTokens(response.accessToken, response.refreshToken)
    setUser(response.user)
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken()
    try {
      await logoutRequest(refreshToken)
    } catch {
      // Local logout should still happen when the API is unavailable.
    }
    clearTokens()
    setUser(null)
  }, [])

  const hasPermission = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user],
  )

  const value = useMemo(
    () => ({ user, loading, login, logout, hasPermission }),
    [hasPermission, loading, login, logout, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
