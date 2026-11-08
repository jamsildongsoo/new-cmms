import { LogOut, Menu } from 'lucide-react'
import { useAuth } from '@/modules/auth'
import { Button } from '@/shared/ui/Button'
export function Topbar({
  menuOpen,
  onToggleMenu,
}: {
  menuOpen: boolean
  onToggleMenu: () => void
}) {
  const { logout, user, error, reloadUser, loading } = useAuth()
  return (
    <>
      <header className="sticky top-0 z-20 flex min-h-12 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label="업무 메뉴 열기"
            aria-expanded={menuOpen}
            aria-controls="app-menu"
            className="p-1 lg:hidden"
            onClick={onToggleMenu}
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="text-xs text-slate-600">
            회사 {user?.companyId} · 사용자 {user?.userId}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" />
          로그아웃
        </Button>
      </header>
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 border-b bg-amber-50 px-4 py-2 text-xs"
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
