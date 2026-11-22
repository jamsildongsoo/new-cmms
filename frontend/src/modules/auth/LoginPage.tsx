import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { AuthStatus } from './AuthStatus'
import { useAuth } from './useAuth'
export function LoginPage() {
  const {
      login,
      user,
      loading,
      error: sessionError,
      notice: sessionNotice,
      reloadUser,
      logout,
    } = useAuth(),
    navigate = useNavigate(),
    location = useLocation()
  const notice =
    (location.state as { notice?: string } | null)?.notice ?? sessionNotice
  const from = (
    location.state as {
      from?: { pathname?: string; search?: string; hash?: string }
    } | null
  )?.from
  const destination =
    from?.pathname?.startsWith('/') &&
    !from.pathname.startsWith('//') &&
    from.pathname !== '/login'
      ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
      : '/'
  const [companyId, setCompanyId] = useState(''),
    [userId, setUserId] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [submitting, setSubmitting] = useState(false)
  if (!user && (loading || sessionError))
    return (
      <AuthStatus
        loading={loading}
        error={sessionError}
        retry={reloadUser}
        onLogin={logout}
      />
    )
  if (user) return <Navigate to={destination} replace />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login({
        companyId: companyId.trim(),
        userId: userId.trim(),
        password,
      })
      navigate(destination, { replace: true })
    } catch {
      setError(
        '로그인하지 못했습니다. 회사·사용자·비밀번호와 연결 상태를 확인하십시오.',
      )
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-sm space-y-3 border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-slate-900">CMMS 로그인</h1>
        <Field label="회사 ID" required>
          <Input
            required
            autoComplete="organization"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          />
        </Field>
        <Field label="사용자 ID" required>
          <Input
            required
            autoComplete="username"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </Field>
        <Field label="비밀번호" required>
          <Input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {notice && (
          <p
            role="status"
            className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
          >
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? '로그인 중...' : '로그인'}
        </Button>
      </form>
    </main>
  )
}
