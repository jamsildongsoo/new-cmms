import { ChevronDown, KeyRound, LogOut, Menu, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { AccountPanel, getProfile, type UserProfile } from '@/modules/identity'
import { toMessage } from '@/shared/api/errors'
import { Button } from '@/shared/ui/Button'
import { menuGroups } from './menu'

export function Topbar({
  menuOpen,
  onToggleMenu,
}: {
  menuOpen: boolean
  onToggleMenu: () => void
}) {
  const { logout, user, error, reloadUser, loading } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const menuRef = useRef<HTMLDetailsElement>(null)
  const [panel, setPanel] = useState<'profile' | 'password' | null>(null)
  const [profileError, setProfileError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const { pathname } = useLocation()
  const page = menuGroups
    .flatMap((group) => group.items)
    .filter(
      (item) =>
        pathname === item.path ||
        (item.path !== '/' && pathname.startsWith(`${item.path}/`)),
    )
    .sort((a, b) => b.path.length - a.path.length)[0]

  useEffect(() => {
    let active = true
    if (user)
      getProfile()
        .then((data) => {
          if (active) {
            setProfile(data)
            setProfileError('')
          }
        })
        .catch((failure) => {
          if (active) setProfileError(toMessage(failure))
        })
    return () => {
      active = false
    }
  }, [user, refresh])

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target) &&
        menuRef.current
      )
        menuRef.current.open = false
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuRef.current?.open) {
        menuRef.current.open = false
        menuRef.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [])

  const ownProfile =
    profile?.userId === user?.userId && profile?.companyId === user?.companyId
      ? profile
      : null
  const name = String(ownProfile?.name || user?.userId || '')

  return (
    <>
      <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label="업무 메뉴 열기"
            aria-expanded={menuOpen}
            aria-controls="app-menu"
            className="rounded-md p-2 focus-visible:outline-blue-600 lg:hidden"
            onClick={onToggleMenu}
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="truncate text-sm font-medium text-slate-700">
            {page?.label ?? 'CMMS'}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden text-xs text-slate-500 md:block">
            회사 {ownProfile?.companyName || user?.companyId}
            {user?.siteId
              ? ` · 사업장 ${ownProfile?.siteName || user.siteId}`
              : ''}
          </span>
          <details
            ref={menuRef}
            className="relative"
            onBlur={(event) => {
              if (
                event.relatedTarget instanceof Node &&
                !event.currentTarget.contains(event.relatedTarget)
              )
                event.currentTarget.open = false
            }}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-800 hover:bg-slate-50 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
              <UserRound className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="max-w-36 truncate">{name}</span>
              <span className="hidden text-xs text-slate-500 sm:inline">
                {ownProfile?.deptName || user?.deptId}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </summary>
            <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
              <div className="mb-1 border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
                사용자 {user?.userId}
              </div>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
                disabled={!ownProfile}
                onClick={() => {
                  setPanel('profile')
                  if (menuRef.current) menuRef.current.open = false
                }}
              >
                <UserRound className="h-4 w-4" />내 정보 수정
              </button>
              <button
                type="button"
                disabled={!ownProfile}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
                onClick={() => {
                  setPanel('password')
                  if (menuRef.current) menuRef.current.open = false
                }}
              >
                <KeyRound className="h-4 w-4" />
                비밀번호 변경
              </button>
              {profileError && (
                <div role="alert" className="px-3 py-2 text-xs text-red-700">
                  {profileError}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setProfileError('')
                      setRefresh((value) => value + 1)
                    }}
                  >
                    다시 시도
                  </Button>
                </div>
              )}
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => void logout()}
              >
                <LogOut className="h-4 w-4" />
                로그아웃
              </button>
            </div>
          </details>
        </div>
      </header>
      {panel && ownProfile && (
        <AccountPanel
          mode={panel}
          profile={ownProfile}
          onSaved={setProfile}
          onClose={() => {
            setPanel(null)
            requestAnimationFrame(() =>
              menuRef.current?.querySelector('summary')?.focus(),
            )
          }}
        />
      )}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 border-b bg-amber-50 px-4 py-2 text-xs"
        >
          <span>{error}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={() => void reloadUser()}
          >
            다시 확인
          </Button>
        </div>
      )}
    </>
  )
}
