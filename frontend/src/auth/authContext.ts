import { createContext } from 'react'
import type { LoginRequest, UserContext } from '../types/auth'

export interface AuthContextValue {
  user: UserContext | null
  loading: boolean
  login: (payload: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
