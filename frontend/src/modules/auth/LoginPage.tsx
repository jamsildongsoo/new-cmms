import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { useAuth } from './useAuth'

export function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    location.state &&
    typeof location.state === 'object' &&
    'from' in location.state
      ? (location.state.from as { pathname?: string }).pathname
      : '/'

  const [companyId, setCompanyId] = useState('CR')
  const [userId, setUserId] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await login({ companyId, userId, password })
      navigate(from ?? '/', { replace: true })
    } catch {
      setError('Login failed. Check company, user, and password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-5">
          <h1 className="text-base font-semibold text-slate-900">CMMS Login</h1>
          <p className="mt-1 text-xs text-slate-500">
            Backend function test console
          </p>
        </div>

        <div className="space-y-3">
          <Field label="Company ID" required>
            <Input
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
            />
          </Field>
          <Field label="User ID" required>
            <Input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            />
          </Field>
          <Field label="Password" required>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <Button type="submit" className="mt-5 w-full" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Login'}
        </Button>
      </form>
    </main>
  )
}
