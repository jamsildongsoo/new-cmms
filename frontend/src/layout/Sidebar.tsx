import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '@/modules/auth'
import { visibleMenuGroups } from './menu'
export function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { hasPermission } = useAuth()
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="메뉴 닫기"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        id="app-menu"
        aria-label="업무 메뉴"
        className={`${open ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-40 h-dvh w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex`}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-4">
          <span className="text-base font-semibold text-slate-900">CMMS</span>
          <button
            type="button"
            aria-label="메뉴 접기"
            className="p-1 lg:hidden"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav
          aria-label="주 메뉴"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
        >
          {visibleMenuGroups(hasPermission).map((group) => (
            <div key={group.label}>
              <div className="mb-1 px-2 text-xs font-semibold text-slate-400">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        [
                          'flex h-8 items-center gap-2 px-2 text-xs font-medium',
                          isActive
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                        ].join(' ')
                      }
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
