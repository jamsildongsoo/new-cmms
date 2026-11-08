export interface UserContext {
  companyId: string
  userId: string
  roleId: string
  deptId: string
  siteId: string | null
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
  tokenType: 'Bearer'
  user: UserContext
}
