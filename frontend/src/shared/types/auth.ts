export interface UserContext {
  companyId: string
  userId: string
  roleId: string
  deptId: string
  siteId?: string | null
  accessScope: string
  permissions: string[]
}

export interface LoginRequest {
  companyId: string
  userId: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken?: string
  tokenType: 'Bearer'
  user: UserContext
}

export interface RefreshResponse {
  accessToken: string
  refreshToken?: string
  tokenType: 'Bearer'
}
