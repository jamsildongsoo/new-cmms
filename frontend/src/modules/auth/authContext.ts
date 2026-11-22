// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { createContext } from 'react'
import type { LoginRequest, UserContext } from '@/shared/types/auth'

export interface AuthContextValue {
  user: UserContext | null
  loading: boolean
  error: string
  notice: string
  reloadUser: () => Promise<void>
  login: (payload: LoginRequest) => Promise<void>
  logout: (notice?: string) => Promise<void>
  hasPermission: (permission: string) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
