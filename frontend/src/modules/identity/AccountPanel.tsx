import { useMetadata } from '@/shared/metadata/metadata'
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { UserProfile } from './user-profile.types'
import { toMessage } from '@/shared/api/errors'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import { changePassword, updateProfile } from './user-profile.api'
import { useAuth } from '@/modules/auth'

export function AccountPanel({
  mode,
  profile,
  onClose,
  onSaved,
}: {
  mode: 'profile' | 'password'
  profile: UserProfile
  onClose: () => void
  onSaved: (profile: UserProfile) => void
}) {
  const { accessScopes } = useMetadata()
  const scopeLabels = Object.fromEntries(
    accessScopes.map(({ value, label }) => [value, label]),
  )
  const dialog = useRef<HTMLDialogElement>(null)
  const [contact, setContact] = useState({
    email: profile.email ?? '',
    phoneNumber: profile.phoneNumber ?? '',
  })
  const [baseline, setBaseline] = useState(JSON.stringify(contact))
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const { logout } = useAuth()
  const dirty =
    mode === 'profile'
      ? JSON.stringify(contact) !== baseline
      : Object.values(passwords).some(Boolean)
  useUnsavedChanges(dirty && !busy)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  const close = () => {
    if (busy) return
    if (
      dirty &&
      !window.confirm('저장하지 않은 변경사항이 있습니다. 닫으시겠습니까?')
    )
      return
    onClose()
  }
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError('')
    setNotice('')
    if (mode === 'password') {
      if (passwords.newPassword !== passwords.confirmPassword) {
        setError('새 비밀번호와 확인 입력이 일치하지 않습니다.')
        return
      }
      if (
        !/[A-Za-z]/.test(passwords.newPassword) ||
        !/\d/.test(passwords.newPassword) ||
        new TextEncoder().encode(passwords.newPassword).length > 72
      ) {
        setError(
          '새 비밀번호는 영문과 숫자를 포함한 10자 이상, 72바이트 이내로 입력해 주세요.',
        )
        return
      }
    }
    setBusy(true)
    try {
      if (mode === 'profile') {
        const saved = await updateProfile({
          email: contact.email.trim() || null,
          phoneNumber: contact.phoneNumber.trim() || null,
        })
        const next = {
          email: saved.email ?? '',
          phoneNumber: saved.phoneNumber ?? '',
        }
        setContact(next)
        setBaseline(JSON.stringify(next))
        onSaved(saved)
        setNotice('내 정보를 저장했습니다.')
      } else {
        await changePassword({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword,
        })
        await logout(
          '비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인해 주세요.',
        )
      }
    } catch (failure) {
      setError(toMessage(failure))
    } finally {
      setBusy(false)
    }
  }
  const information = [
    ['이름', profile.name],
    ['사용자 ID', profile.userId],
    ['회사', profile.companyName || profile.companyId],
    ['사업장', profile.siteName || profile.siteId || '-'],
    ['부서', profile.deptName || profile.deptId || '-'],
    ['직책', profile.title || '-'],
    ['직위', profile.position || '-'],
    ['역할', profile.roleName || profile.roleId],
    ['조회 범위', scopeLabels[profile.accessScope] || profile.accessScope],
  ]
  return (
    <dialog
      ref={dialog}
      aria-labelledby="account-panel-title"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-md border-0 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/30"
    >
      <form
        className="flex h-full flex-col"
        onSubmit={(event) => void save(event)}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="account-panel-title" className="text-base font-semibold">
            {mode === 'profile' ? '내 정보 수정' : '비밀번호 변경'}
          </h2>
          <Button
            type="button"
            variant="ghost"
            aria-label="사용자 설정 닫기"
            disabled={busy}
            onClick={close}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {mode === 'profile' ? (
            <>
              <dl className="grid grid-cols-2 gap-4">
                {information.map(([label, value]) => (
                  <div key={label}>
                    <dt className="mb-1 text-sm font-medium text-slate-600">
                      {label}
                    </dt>
                    <dd className="break-words text-xs text-slate-900">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <Field label="이메일">
                  <Input
                    type="email"
                    autoComplete="email"
                    maxLength={255}
                    value={contact.email}
                    disabled={busy}
                    onChange={(event) =>
                      setContact((value) => ({
                        ...value,
                        email: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="전화번호">
                  <Input
                    type="tel"
                    autoComplete="tel"
                    maxLength={50}
                    value={contact.phoneNumber}
                    disabled={busy}
                    onChange={(event) =>
                      setContact((value) => ({
                        ...value,
                        phoneNumber: event.target.value,
                      }))
                    }
                  />
                </Field>
                <p className="text-xs text-slate-500">
                  이름·소속·역할 변경은 사용자 관리자에게 요청해 주세요.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                새 비밀번호는 영문과 숫자를 포함해 10자 이상, 72바이트 이내로
                입력해 주세요. 변경하면 모든 기기에서 다시 로그인해야 합니다.
              </p>
              <Field label="현재 비밀번호" required>
                <Input
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={255}
                  value={passwords.currentPassword}
                  disabled={busy}
                  onChange={(event) =>
                    setPasswords((value) => ({
                      ...value,
                      currentPassword: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="새 비밀번호" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={72}
                  value={passwords.newPassword}
                  disabled={busy}
                  onChange={(event) =>
                    setPasswords((value) => ({
                      ...value,
                      newPassword: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="새 비밀번호 확인" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={72}
                  value={passwords.confirmPassword}
                  disabled={busy}
                  onChange={(event) =>
                    setPasswords((value) => ({
                      ...value,
                      confirmPassword: event.target.value,
                    }))
                  }
                />
              </Field>
            </>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
            >
              {notice}
            </p>
          )}
        </div>
        <div className="page-actions border-t border-slate-200 p-5">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={close}
          >
            취소
          </Button>
          <Button
            type="submit"
            disabled={busy || (mode === 'profile' && !dirty)}
          >
            {busy ? '처리 중…' : mode === 'profile' ? '저장' : '비밀번호 변경'}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
