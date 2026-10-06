import { LogOut } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { Button } from '../components/ui/Button'

export function Topbar() {
  const { logout, user } = useAuth()

  return (
    <header className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div>
        <div className="text-sm font-semibold text-slate-900">
          CMMS Backend Check
        </div>
        <div className="text-xs text-slate-500">
          {user?.companyId} / {user?.userId} / {user?.roleId}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={() => void logout()}>
        <LogOut className="h-4 w-4" />
        Logout
      </Button>
    </header>
  )
}
