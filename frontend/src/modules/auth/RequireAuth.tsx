import { MetadataProvider } from '@/shared/metadata/MetadataProvider'
/** 최초 세션 복원을 기다리고 회사/사용자 변경 시 이전 업무 화면의 로컬 상태를 폐기한다. */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { AuthStatus } from './AuthStatus'
export function RequireAuth() {
  const { loading, user, error, reloadUser, logout } = useAuth(),
    location = useLocation()
  if (!user && (loading || error))
    return (
      <AuthStatus
        loading={loading}
        error={error}
        retry={reloadUser}
        onLogin={logout}
      />
    )
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  // 다른 회사/사용자로 전환되면 이전 화면의 로컬 입력·조회 상태도 폐기한다.
  return (
    <MetadataProvider key={`${user.companyId}:${user.userId}`}>
      <Outlet />
    </MetadataProvider>
  )
}
