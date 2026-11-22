import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { menuGroups } from './menu'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
export function AppLayout() {
  const { pathname } = useLocation()
  const { hasPermission } = useAuth()
  // 권한 원본: backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
  const permission = pathname.startsWith('/inventory-document')
    ? 'INVDOC:read'
    : menuGroups
        .flatMap((group) => group.items)
        .find(
          (item) =>
            item.path !== '/' &&
            (pathname === item.path || pathname.startsWith(item.path + '/')),
        )?.permission
  const allowed = !permission || hasPermission(permission)
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((open) => !open)}
        />
        <main className="app-content min-w-0 flex-1 p-4 md:p-6">
          {allowed ? <Outlet /> : <p role="alert">조회 권한이 없습니다.</p>}
        </main>
      </div>
    </div>
  )
}
