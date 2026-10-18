import type { LoginRequest, LoginResponse, UserContext } from '@/shared/types/auth'
import { http } from '@/shared/api/http'

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const response = await http.post<LoginResponse>('/auth/login', payload)
  return response.data
}

export async function getMe(): Promise<UserContext> {
  const response = await http.get<UserContext>('/auth/me')
  return response.data
}

export async function logout(refreshToken?: string | null): Promise<void> {
  if (!refreshToken) {
    return
  }
  await http.post('/auth/logout', { refreshToken })
}
