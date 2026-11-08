import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { visibleMenuGroups } from '@/layout/menu'
export function HomePage() {
  const { user, hasPermission } = useAuth()
  return (
    <section className="space-y-4">
      <h1 className="text-base font-semibold">홈</h1>
      <p className="text-xs text-slate-600">
        회사 {user?.companyId} · 사용자 {user?.userId} · 사업장{' '}
        {user?.siteId ?? '-'} · 부서 {user?.deptId ?? '-'}
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleMenuGroups(hasPermission)
          .filter((g) => g.label !== '홈')
          .map((group) => (
            <section
              key={group.label}
              className="space-y-2 border border-slate-200 bg-white p-3"
            >
              <h2 className="text-sm font-semibold">{group.label}</h2>
              <div className="grid gap-1">
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="p-2 text-xs text-blue-700 hover:bg-slate-50"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </section>
          ))}
      </div>
    </section>
  )
}
