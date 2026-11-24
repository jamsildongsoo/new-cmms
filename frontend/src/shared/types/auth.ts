export interface UserContext {
  companyId: string
  userId: string
  roleId: string
  deptId: string | null
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

export interface LoginHistoryItem {
  id: string
  companyId: string
  userId: string
  success: boolean
  failureReason: string | null
  ipAddress: string | null
  userAgent: string | null
  attemptedAt: string
}
export interface LoginHistoryQuery {
  from?: string
  to?: string
  userId?: string
  result?: 'success' | 'failure' | ''
  page?: number
}
