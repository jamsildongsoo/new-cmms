import type {
  LoginRequest,
  LoginResponse,
  UserContext,
  LoginHistoryQuery,
  LoginHistoryItem,
} from '@/shared/types/auth'
import { http } from '@/shared/api/http'

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const response = await http.post<LoginResponse>('/auth/login', payload)
  return response.data
}

export async function getMe(): Promise<UserContext> {
  const response = await http.get<UserContext>('/auth/me')
  return response.data
}

export async function getLoginHistory(query: LoginHistoryQuery) {
  return (
    await http.get<{
      items: LoginHistoryItem[]
      total: number
      page: number
      limit: number
    }>('/auth/login-history', {
      params: Object.fromEntries(
        Object.entries(query).filter(
          ([, value]) => value !== '' && value !== undefined,
        ),
      ),
    })
  ).data
}
