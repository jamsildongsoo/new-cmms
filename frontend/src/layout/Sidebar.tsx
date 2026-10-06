import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { menuGroups } from './menu'

export function Sidebar() {
  const { hasPermission } = useAuth()

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
      <div className="flex h-12 flex-col justify-center border-b border-slate-200 px-4">
        <div className="text-base font-semibold text-slate-900">new-cmms</div>
        <div className="text-xs text-slate-500">Function test</div>
      </div>

      <nav className="space-y-4 p-4">
        {menuGroups.map((group) => {
          const items = group.items.filter(
            (item) => !item.permission || hasPermission(item.permission),
          )
          if (items.length === 0) {
            return null
          }

          return (
            <div key={group.label}>
              <div className="mb-1 px-2 text-xs font-semibold uppercase text-slate-400">
                {group.label}
              </div>
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
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
          )
        })}
      </nav>
    </aside>
  )
}
